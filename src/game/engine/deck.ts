import { Card, RANKS, SUITS } from './types'

/** Build an ordered 52-card deck. */
export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit, id: `${rank}${suit}` })
    }
  }
  return deck
}

/**
 * Fisher-Yates shuffle. Accepts an injectable RNG so the engine stays
 * deterministic in tests; defaults to Math.random for gameplay.
 */
export function shuffle(deck: Card[], rng: () => number = Math.random): Card[] {
  const out = deck.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Fresh, shuffled deck ready to deal. */
export function freshDeck(rng: () => number = Math.random): Card[] {
  return shuffle(createDeck(), rng)
}
