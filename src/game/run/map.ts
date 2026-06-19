// The run map — a short branching descent toward the boss (Slay the Spire's act
// map, distilled). Each step offers a few node choices; the player picks one and
// advances. The final step is always the boss, giving the run a real arc:
// survive the descent, break the Clockwork Maw, and you WIN.
//
// Generation is pure given an RNG, so a seed reproduces a whole map (useful for
// tests and daily-run style features later).

import {
  NORMAL_POOL,
  ELITE_POOL,
  BOSS_ID,
  pickCreature,
  getCreature,
} from '../content/creatures'
import { pickEvent, getEvent } from '../content/events'

export type NodeType = 'dealer' | 'elite' | 'shop' | 'event' | 'rest' | 'boss'

export interface MapNode {
  type: NodeType
  /** dealer / elite / boss → the creature to face. */
  creatureId?: string
  /** event → the event to resolve. */
  eventId?: string
  /** Short label for the map button. */
  label: string
  /** One-line subtitle (creature title, event name, etc.). */
  sub: string
}

export interface RunMap {
  /** columns[i] is the set of choices presented at descent step i. */
  columns: MapNode[][]
}

/** How many choice-steps before the boss. */
export const MAP_DEPTH = 7

const NODE_ICON: Record<NodeType, string> = {
  dealer: '🂠',
  elite: '☠',
  shop: '⚖',
  event: '?',
  rest: '✛',
  boss: '☼',
}

export function nodeIcon(type: NodeType): string {
  return NODE_ICON[type]
}

function dealerNode(creatureId: string, elite: boolean): MapNode {
  const c = getCreature(creatureId)
  return {
    type: elite ? 'elite' : 'dealer',
    creatureId,
    label: c.name,
    sub: elite ? `Elite — ${c.title}` : c.title,
  }
}

function eventNode(eventId: string): MapNode {
  return { type: 'event', eventId, label: 'A Door', sub: getEvent(eventId).name }
}

const SHOP_NODE: MapNode = { type: 'shop', label: 'The Pawnbroker', sub: 'Trade souls for power' }
const REST_NODE: MapNode = { type: 'rest', label: 'A Cold Hearth', sub: 'Mend a wound, or scavenge' }

/**
 * Build a full run map. Difficulty + variety ramp with depth:
 * early steps are mostly ordinary dealers; elites, shops, events and rests
 * weave in as you descend; the last column is the boss alone.
 */
export function generateMap(rng: () => number = Math.random): RunMap {
  const columns: MapNode[][] = []
  const usedCreatures: string[] = []

  for (let depth = 0; depth < MAP_DEPTH; depth++) {
    const optionCount = depth === 0 ? 2 : rng() < 0.5 ? 2 : 3
    const col: MapNode[] = []
    const typesThisCol = new Set<NodeType>()

    for (let i = 0; i < optionCount; i++) {
      const type = rollNodeType(depth, typesThisCol, rng)
      typesThisCol.add(type)

      if (type === 'dealer') {
        const id = pickCreature(NORMAL_POOL, usedCreatures, rng)
        usedCreatures.push(id)
        col.push(dealerNode(id, false))
      } else if (type === 'elite') {
        const id = pickCreature(ELITE_POOL, usedCreatures, rng)
        usedCreatures.push(id)
        col.push(dealerNode(id, true))
      } else if (type === 'event') {
        col.push(eventNode(pickEvent(rng)))
      } else if (type === 'shop') {
        col.push(SHOP_NODE)
      } else {
        col.push(REST_NODE)
      }
    }
    columns.push(col)
  }

  // The boss waits at the bottom.
  columns.push([bossNode()])
  return { columns }
}

function bossNode(): MapNode {
  const c = getCreature(BOSS_ID)
  return { type: 'boss', creatureId: BOSS_ID, label: c.name, sub: c.title }
}

/** Weighted node-type roll that respects depth and avoids dull duplicate columns. */
function rollNodeType(
  depth: number,
  taken: Set<NodeType>,
  rng: () => number,
): NodeType {
  // Base weights by depth band.
  const w: Record<Exclude<NodeType, 'boss'>, number> = {
    dealer: 5,
    elite: depth >= 3 ? 2.2 : 0,
    shop: depth >= 1 ? 1.4 : 0,
    event: depth >= 1 ? 2 : 0,
    rest: depth >= 2 ? 1.2 : 0,
  }
  // Discourage two of the same special node in one column (dealers may repeat).
  for (const t of taken) {
    if (t !== 'dealer' && t in w) (w as Record<string, number>)[t] *= 0.15
  }

  const entries = Object.entries(w).filter(([, v]) => v > 0) as [
    Exclude<NodeType, 'boss'>,
    number,
  ][]
  const total = entries.reduce((s, [, v]) => s + v, 0)
  let r = rng() * total
  for (const [type, v] of entries) {
    r -= v
    if (r <= 0) return type
  }
  return 'dealer'
}
