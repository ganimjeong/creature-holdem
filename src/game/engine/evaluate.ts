// Thin wrapper around `pokersolver` so the rest of the codebase never touches
// its loosely-typed API directly. pokersolver evaluates 5-7 card hands, names
// them ("Two Pair", "Flush", ...) and compares them.
import pkg from 'pokersolver'
import { Card, cardCode } from './types'

// pokersolver ships as CommonJS with a `Hand` export.
const { Hand } = pkg as unknown as { Hand: PokerSolverHand }

interface SolvedHand {
  name: string
  descr: string
  rank: number
  cards: unknown[]
}

interface PokerSolverHand {
  solve(cards: string[]): SolvedHand
  winners(hands: SolvedHand[]): SolvedHand[]
}

export interface HandStrength {
  /** Human-facing name, e.g. "Full House". */
  name: string
  /** Detailed description, e.g. "Full House, A's over K's". */
  description: string
  /** Internal solved object (used for comparison only). */
  solved: SolvedHand
}

/** Evaluate the best 5-card hand from any 5-7 cards. */
export function evaluateHand(cards: Card[]): HandStrength {
  const solved = Hand.solve(cards.map(cardCode))
  return { name: solved.name, description: solved.descr, solved }
}

export type Showdown =
  | { winner: 'player'; player: HandStrength; dealer: HandStrength }
  | { winner: 'dealer'; player: HandStrength; dealer: HandStrength }
  | { winner: 'split'; player: HandStrength; dealer: HandStrength }

/**
 * Compare the player's and dealer's seven-card sets (hole + community).
 */
export function compareHands(
  playerCards: Card[],
  dealerCards: Card[],
): Showdown {
  const player = evaluateHand(playerCards)
  const dealer = evaluateHand(dealerCards)
  const winners = Hand.winners([player.solved, dealer.solved])

  const playerWon = winners.includes(player.solved)
  const dealerWon = winners.includes(dealer.solved)

  if (playerWon && dealerWon) return { winner: 'split', player, dealer }
  if (playerWon) return { winner: 'player', player, dealer }
  return { winner: 'dealer', player, dealer }
}
