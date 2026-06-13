// The creature dealer's brain. Intentionally simple but believable: it reads its
// current made-hand strength, mixes in a little aggression and the occasional
// bluff, and picks a legal action. Pure given an RNG (defaults to Math.random).

import { HandState, ActionType, getLegalActions } from './holdem'
import { evaluateHand } from './evaluate'
import { Card, Rank } from './types'

interface Decision {
  action: ActionType
  raiseTo?: number
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

/** Made-hand strength once community cards exist. */
function madeStrength(state: HandState): number {
  const cards = [...state.dealer.hole, ...state.community]
  const hand = evaluateHand(cards)
  return HAND_STRENGTH[hand.name] ?? 0.2
}

export function dealerStrength(state: HandState): number {
  return state.community.length === 0
    ? preflopStrength(state.dealer.hole)
    : madeStrength(state)
}

/** Decide the dealer's action for the current state. */
export function decideDealerAction(
  state: HandState,
  rng: () => number = Math.random,
): Decision {
  const legal = getLegalActions(state, 'dealer')
  const strength = dealerStrength(state)
  const noise = (rng() - 0.5) * 0.18
  const score = Math.max(0, Math.min(1, strength + noise))

  const pot = state.pot
  const callAmt = legal.callAmount

  // Pot-fraction sizing for raises.
  const raiseBy = Math.max(state.bigBlind, Math.round(pot * (0.5 + rng() * 0.4)))
  const raiseTo = state.currentBet + raiseBy
  const bluff = rng() < 0.12

  if (legal.canCheck) {
    // No one has bet: value-bet strong hands, occasionally bluff.
    if (score > 0.6 || bluff) {
      if (legal.canRaise) return { action: 'raise', raiseTo }
    }
    return { action: 'check' }
  }

  // Facing a bet.
  if (score > 0.82 && legal.canRaise) {
    // Monster: shove or big raise.
    return score > 0.93 && rng() < 0.6
      ? { action: 'allin' }
      : { action: 'raise', raiseTo }
  }
  if (score > 0.45) {
    if (score > 0.7 && legal.canRaise && rng() < 0.35) {
      return { action: 'raise', raiseTo }
    }
    return { action: 'call' }
  }

  // Weak: call if it's cheap relative to the pot, otherwise fold (sometimes bluff-raise).
  if (bluff && legal.canRaise) return { action: 'raise', raiseTo }
  if (callAmt <= pot * 0.15 && legal.canCall) return { action: 'call' }
  return legal.canFold ? { action: 'fold' } : { action: 'check' }
}
