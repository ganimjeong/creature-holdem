// The creature dealer's brain. Intentionally simple but believable: it reads its
// current made-hand strength, mixes in a little aggression and the occasional
// bluff, and picks a legal action. Pure given an RNG (defaults to Math.random).
//
// Every creature plays through this one function but is parameterised by an
// `AIProfile` (how aggressive / bluffy / tight it is) and an optional `sight`
// ability (peeking at the player, or river clairvoyance). This keeps the roster
// diverse without forking the decision logic — and, crucially, each edge the
// profile grants is something the player can read and exploit (see creatures.ts
// for the telegraphed counter to each one).

import { HandState, ActionType, getLegalActions } from './holdem'
import { evaluateHand } from './evaluate'
import { Card, Rank } from './types'

interface Decision {
  action: ActionType
  raiseTo?: number
}

/** Knobs that make one creature play differently from another. */
export interface AIProfile {
  /** Propensity to bet/raise rather than call/check (0..1). */
  aggression: number
  /** Base probability of firing a pure bluff when it legally can. */
  bluffFreq: number
  /** Raises the strength bar for committing chips — higher = tighter, folds more. */
  tightness: number
  /** Never bluffs; only commits with genuine strength (the Hoarder). */
  valueOnly: boolean
  /** Echoes the player's aggression — raises when raised into (the Mirror). */
  mirror: boolean
  /** Willingness to call down light (0..1). */
  callStation: number
}

export const DEFAULT_PROFILE: AIProfile = {
  aggression: 0.5,
  bluffFreq: 0.12,
  tightness: 0,
  valueOnly: false,
  mirror: false,
  callStation: 0.3,
}

/** What the creature's ability lets it *know* beyond a fair player. */
export type CreatureSight = 'none' | 'peek' | 'river'

export interface DealerContext {
  profile: AIProfile
  /** Information edge granted by the creature's ability. */
  sight: CreatureSight
  /** Did the player bet or raise on the current street? (drives the Mirror.) */
  playerWasAggressive: boolean
}

export const DEFAULT_CONTEXT: DealerContext = {
  profile: DEFAULT_PROFILE,
  sight: 'none',
  playerWasAggressive: false,
}

const HAND_STRENGTH: Record<string, number> = {
  'High Card': 0.12,
  'Pair': 0.34,
  'Two Pair': 0.55,
  'Three of a Kind': 0.68,
  'Straight': 0.78,
  'Flush': 0.85,
  'Full House': 0.92,
  'Four of a Kind': 0.97,
  'Straight Flush': 0.99,
  'Royal Flush': 1.0,
}

const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
}

/** Rough pre-flop strength (0..1) from two hole cards. */
function preflopStrength(hole: Card[]): number {
  const [a, b] = hole
  const hi = Math.max(RANK_VALUE[a.rank], RANK_VALUE[b.rank])
  const lo = Math.min(RANK_VALUE[a.rank], RANK_VALUE[b.rank])
  const pair = a.rank === b.rank
  const suited = a.suit === b.suit
  const gap = hi - lo

  let s = (hi - 2) / 12 * 0.45 + (lo - 2) / 12 * 0.2
  if (pair) s = 0.5 + (hi - 2) / 12 * 0.5
  if (suited) s += 0.08
  if (!pair && gap <= 2) s += 0.06 // connectors
  return Math.max(0, Math.min(1, s))
}

/** Made-hand strength (0..1) for a seat's hole + the community. */
function madeStrengthFor(hole: Card[], community: Card[]): number {
  const hand = evaluateHand([...hole, ...community])
  return HAND_STRENGTH[hand.name] ?? 0.2
}

export function dealerStrength(state: HandState): number {
  return state.community.length === 0
    ? preflopStrength(state.dealer.hole)
    : madeStrengthFor(state.dealer.hole, state.community)
}

/** The player's made strength — only consulted by creatures whose ability lets them peek. */
function playerStrength(state: HandState): number {
  return state.community.length === 0
    ? preflopStrength(state.player.hole)
    : madeStrengthFor(state.player.hole, state.community)
}

/**
 * Decide the dealer's action for the current state, given the creature's
 * personality + ability context. Pure given an RNG.
 */
export function decideDealerAction(
  state: HandState,
  ctx: DealerContext = DEFAULT_CONTEXT,
  rng: () => number = Math.random,
): Decision {
  const { profile } = ctx
  const legal = getLegalActions(state, 'dealer')

  // --- River clairvoyance (the Trickster): on the final street it knows the
  // exact result and plays it perfectly — never paying off, hammering winners.
  // Counter: it only "sees" once the river is out, so finish the hand by the turn.
  if (ctx.sight === 'river' && (state.street === 'river' || state.community.length === 5)) {
    const oppNow = playerStrength(state)
    const meNow = dealerStrength(state)
    const winning = meNow > oppNow + 0.001
    if (legal.canCheck) {
      if (winning && legal.canRaise) {
        return { action: 'raise', raiseTo: riverValueRaise(state, rng) }
      }
      return { action: 'check' }
    }
    // Facing a bet with full knowledge: only continue when ahead.
    if (winning) {
      return legal.canRaise && rng() < 0.5
        ? { action: 'raise', raiseTo: riverValueRaise(state, rng) }
        : { action: 'call' }
    }
    return legal.canFold ? { action: 'fold' } : { action: 'check' }
  }

  const noise = (rng() - 0.5) * 0.18
  let strength = dealerStrength(state)

  // --- Peeking sight (the Watcher): it has read one of your cards, so it leans
  // toward the truth — value-betting harder against weakness, backing off into
  // strength. Counter: it only sees ONE card, so semi-bluffs still get through.
  if (ctx.sight === 'peek') {
    const opp = playerStrength(state)
    // Shade the creature's confidence by the gap between the hands (dampened —
    // it knows a card, not the future).
    strength = Math.max(0, Math.min(1, strength + (strength - opp) * 0.25))
  }

  // Tightness pulls effective strength down (it needs more to commit).
  let score = Math.max(0, Math.min(1, strength + noise - profile.tightness * 0.5))

  // --- Mirror (the Hollow Twin): the player's aggression is contagious. When
  // they fire, it fires back; when they go quiet, so does it. Counter: trap it —
  // check your monsters (it checks behind), bet your air (it folds/flats).
  let aggression = profile.aggression
  if (profile.mirror) {
    aggression = ctx.playerWasAggressive ? 0.92 : 0.18
  }

  const pot = state.pot
  const callAmt = legal.callAmount

  // Pot-fraction sizing for raises, scaled by aggression.
  const sizeFactor = 0.45 + aggression * 0.4 + rng() * 0.25
  const raiseBy = Math.max(state.bigBlind, Math.round(pot * sizeFactor))
  const raiseTo = state.currentBet + raiseBy
  const bluff = !profile.valueOnly && rng() < profile.bluffFreq * (0.5 + aggression)

  if (legal.canCheck) {
    // No one has bet: value-bet strong hands, occasionally bluff.
    const valueBar = 0.6 - aggression * 0.18
    if (score > valueBar || bluff) {
      if (legal.canRaise && rng() < 0.55 + aggression * 0.4) {
        return { action: 'raise', raiseTo }
      }
    }
    return { action: 'check' }
  }

  // Facing a bet.
  const shoveBar = 0.82 + profile.tightness * 0.06
  if (score > shoveBar && legal.canRaise) {
    // Monster: shove or big raise.
    return score > 0.93 && rng() < 0.6
      ? { action: 'allin' }
      : { action: 'raise', raiseTo }
  }
  const contBar = 0.45 - profile.callStation * 0.2
  if (score > contBar) {
    const reRaiseBar = 0.7 - aggression * 0.15
    if (score > reRaiseBar && legal.canRaise && rng() < 0.2 + aggression * 0.4) {
      return { action: 'raise', raiseTo }
    }
    return { action: 'call' }
  }

  // Weak: call if it's cheap relative to the pot, otherwise fold (sometimes bluff-raise).
  if (bluff && legal.canRaise) return { action: 'raise', raiseTo }
  const cheapBar = pot * (0.12 + profile.callStation * 0.18)
  if (callAmt <= cheapBar && legal.canCall) return { action: 'call' }
  return legal.canFold ? { action: 'fold' } : { action: 'check' }
}

/** A value-oriented raise size used by river clairvoyance. */
function riverValueRaise(state: HandState, rng: () => number): number {
  const by = Math.max(state.bigBlind, Math.round(state.pot * (0.6 + rng() * 0.5)))
  return state.currentBet + by
}
