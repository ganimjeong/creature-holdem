// Core card + poker types shared across the engine, store, and 3D scene.

export type Suit = 's' | 'h' | 'd' | 'c' // spades, hearts, diamonds, clubs
export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A'

export interface Card {
  rank: Rank
  suit: Suit
  /** Stable id used as a React key and to drive flip/deal animations. */
  id: string
}

/** pokersolver expects strings like "As", "Td", "9h". */
export function cardCode(card: Card): string {
  return `${card.rank}${card.suit}`
}

export const SUITS: Suit[] = ['s', 'h', 'd', 'c']
export const RANKS: Rank[] = [
  '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A',
]

export const SUIT_SYMBOL: Record<Suit, string> = {
  s: '♠', // ♠
  h: '♥', // ♥
  d: '♦', // ♦
  c: '♣', // ♣
}

export const SUIT_IS_RED: Record<Suit, boolean> = {
  s: false,
  h: true,
  d: true,
  c: false,
}

export type Seat = 'player' | 'dealer'
