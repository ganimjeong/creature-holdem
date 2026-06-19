// The bestiary. Each round of the run seats a different creature across the felt,
// and every creature is built around ONE memorable edge — plus a telegraphed
// weakness (`tell`) that the player can read and punish. No creature is unbeatable:
// the design rule is that every advantage has a counter the player can lean into.
//
//   profile  → how it bets (aggression / bluffing / tightness), fed to dealerAI
//   ability  → a rules-or-info edge the store/modifiers apply
//   tell     → the counter, shown to the player on the intro card + HUD
//
// References in the mood: Inscryption's Leshy (a dealer that bends the rules),
// Slay the Spire elites (a signature gimmick each), Balatro (legible modifiers).

import { AIProfile } from '../engine/dealerAI'

/** A rules/info edge a creature brings to the table. */
export type CreatureAbility =
  | { kind: 'none' }
  /** Skims a fraction of every pot into the void — no one can win it. */
  | { kind: 'rake'; pct: number }
  /** Blinds escalate one step every `everyHands` hands within the round. */
  | { kind: 'blindRamp'; everyHands: number }
  /** Sees one of your hole cards each hand (and plays sharper for it). */
  | { kind: 'peek' }
  /** Each showdown it wins drinks `souls` of yours. */
  | { kind: 'soulLeech'; souls: number }
  /** On the river it plays with perfect knowledge of the result. */
  | { kind: 'riverSight' }
  /** Starts the round with `mult`× the normal stack. */
  | { kind: 'chipLead'; mult: number }

export type CreatureTier = 'normal' | 'elite' | 'boss'

export interface Creature {
  id: string
  /** Short name shown big, e.g. "The Gambler". */
  name: string
  /** Ominous subtitle, e.g. "Maw of Wagers". */
  title: string
  flavor: string
  /** The counter — how the player beats this creature's edge. Always present. */
  tell: string
  /** Hex eye-glow color used by the 3D dealer for instant recognition. */
  eyeColor: string
  /** Body scale multiplier (bigger = more menacing). */
  scale: number
  tier: CreatureTier
  profile: AIProfile
  ability: CreatureAbility
  /** Souls awarded for busting this creature. */
  bounty: number
}

// Sickly palette echoing layout.ts THEME, but each creature owns a distinct hue.
export const CREATURES: Record<string, Creature> = {
  gambler: {
    id: 'gambler',
    name: 'The Gambler',
    title: 'Maw of Wagers',
    flavor:
      'It shoves with a grin of brass teeth, betting like every hand is its last.',
    tell: 'It overreaches and bluffs too often. Call it down — let it bleed itself dry.',
    eyeColor: '#ff8a1a',
    scale: 1.0,
    tier: 'normal',
    profile: { aggression: 0.9, bluffFreq: 0.34, tightness: -0.04, valueOnly: false, mirror: false, callStation: 0.45 },
    ability: { kind: 'none' },
    bounty: 4,
  },

  hoarder: {
    id: 'hoarder',
    name: 'The Hoarder',
    title: 'Brass Glutton',
    flavor:
      'A bloated thing of coin and gear. It comes to the felt already rich, and it never lies.',
    tell: 'It never bluffs — so steal its pots freely, but fold the instant it pushes back.',
    eyeColor: '#f3c259',
    scale: 1.18,
    tier: 'normal',
    profile: { aggression: 0.35, bluffFreq: 0, tightness: 0.16, valueOnly: true, mirror: false, callStation: 0.15 },
    ability: { kind: 'chipLead', mult: 1.8 },
    bounty: 5,
  },

  watcher: {
    id: 'watcher',
    name: 'The Watcher',
    title: 'The Hundred-Eyed',
    flavor:
      'Eyes open along its arms, its throat, the backs of your own cards. One of yours is never yours alone.',
    tell: 'It sees ONE of your cards — never both. Bluff with the card it cannot see, or Veil its sight.',
    eyeColor: '#b46cff',
    scale: 1.04,
    tier: 'normal',
    profile: { aggression: 0.55, bluffFreq: 0.1, tightness: 0.08, valueOnly: false, mirror: false, callStation: 0.3 },
    ability: { kind: 'peek' },
    bounty: 6,
  },

  tithe: {
    id: 'tithe',
    name: 'The Tithe-Eater',
    title: 'Mouth of the Toll',
    flavor:
      'Every coin that crosses the felt leaves a little of itself behind, swallowed by the dark beneath the table.',
    tell: 'It taxes every pot. Win small and win fast — never bloat a pot you only half-believe.',
    eyeColor: '#62e08a',
    scale: 1.0,
    tier: 'normal',
    profile: { aggression: 0.5, bluffFreq: 0.14, tightness: 0.05, valueOnly: false, mirror: false, callStation: 0.3 },
    ability: { kind: 'rake', pct: 0.1 },
    bounty: 6,
  },

  furnace: {
    id: 'furnace',
    name: 'Boiler-Heart',
    title: 'The Rising Heat',
    flavor:
      'Its chest is a furnace door, and with every hand the pressure climbs. It wants you to feel the clock.',
    tell: 'Its heat doubles the blinds as hands drag on. Strike early — do not be slow-boiled.',
    eyeColor: '#ff5a2a',
    scale: 1.08,
    tier: 'normal',
    profile: { aggression: 0.62, bluffFreq: 0.16, tightness: 0.0, valueOnly: false, mirror: false, callStation: 0.3 },
    ability: { kind: 'blindRamp', everyHands: 4 },
    bounty: 6,
  },

  twin: {
    id: 'twin',
    name: 'The Hollow Twin',
    title: 'Your Reflection, Wrong',
    flavor:
      'It wears your face badly. When you push, it pushes; when you flinch, it flinches with you.',
    tell: 'It mirrors your aggression. Trap it — check your monsters, bet your air.',
    eyeColor: '#dfe6e8',
    scale: 1.0,
    tier: 'normal',
    profile: { aggression: 0.5, bluffFreq: 0.08, tightness: 0.04, valueOnly: false, mirror: true, callStation: 0.35 },
    ability: { kind: 'none' },
    bounty: 6,
  },

  leech: {
    id: 'leech',
    name: 'The Vein-Drinker',
    title: 'It Counts in Souls',
    flavor:
      'Chips bore it. Every showdown it wins, it sips something warmer from the back of your neck.',
    tell: 'Each showdown it wins drinks a soul. Fold thin rivers, or blind it before the cards turn.',
    eyeColor: '#ff2b4d',
    scale: 1.1,
    tier: 'elite',
    profile: { aggression: 0.6, bluffFreq: 0.12, tightness: 0.1, valueOnly: false, mirror: false, callStation: 0.4 },
    ability: { kind: 'soulLeech', souls: 1 },
    bounty: 9,
  },

  jester: {
    id: 'jester',
    name: 'The Two-Faced Jester',
    title: 'Liar of the River',
    flavor:
      'One face laughs, one weeps, and both have already seen the river card you have not.',
    tell: 'It plays the river with perfect sight — but only the river. Win the hand by the turn.',
    eyeColor: '#ff3df0',
    scale: 1.06,
    tier: 'elite',
    profile: { aggression: 0.7, bluffFreq: 0.2, tightness: 0.0, valueOnly: false, mirror: false, callStation: 0.35 },
    ability: { kind: 'riverSight' },
    bounty: 9,
  },

  maw: {
    id: 'maw',
    name: 'The Clockwork Maw',
    title: 'The Thing Beneath the Table',
    flavor:
      'Every gear in the cabin turns toward it. It is rich, it is greedy, and it has been waiting for you to run out of tricks.',
    tell: 'It hoards a deep stack AND taxes every pot. Patience and your relics are the only way through.',
    eyeColor: '#ff1a1a',
    scale: 1.32,
    tier: 'boss',
    profile: { aggression: 0.78, bluffFreq: 0.22, tightness: 0.06, valueOnly: false, mirror: false, callStation: 0.45 },
    ability: { kind: 'rake', pct: 0.08 },
    bounty: 16,
  },
}

/** Creatures eligible to appear as ordinary dealer encounters. */
export const NORMAL_POOL: string[] = ['gambler', 'hoarder', 'watcher', 'tithe', 'furnace', 'twin']
/** Tougher creatures for elite nodes. */
export const ELITE_POOL: string[] = ['leech', 'jester']
/** The run's final dealer. */
export const BOSS_ID = 'maw'

export function getCreature(id: string): Creature {
  return CREATURES[id] ?? CREATURES.gambler
}

/** Pick a creature id from a pool, avoiding `exclude` when possible. Pure given rng. */
export function pickCreature(
  pool: string[],
  exclude: string[] = [],
  rng: () => number = Math.random,
): string {
  const fresh = pool.filter((id) => !exclude.includes(id))
  const from = fresh.length > 0 ? fresh : pool
  return from[Math.floor(rng() * from.length)]
}
