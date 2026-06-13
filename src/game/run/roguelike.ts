// Roguelike survival-run rules layered on top of the heads-up engine.
//
// The player faces the creature dealer hand after hand. Busting the dealer wins
// the round (the dealer returns with a bigger stack and higher blinds — more
// pressure). Busting yourself costs a life; run out of lives and you die.

export const STARTING_LIVES = 3
export const PLAYER_START_CHIPS = 1000
export const DEALER_START_CHIPS = 1000
/** Reduced stack you respawn with after losing a life (a desperate comeback). */
export const COMEBACK_CHIPS = 600

export interface Blinds {
  sb: number
  bb: number
}

export const BLIND_SCHEDULE: Blinds[] = [
  { sb: 10, bb: 20 },
  { sb: 20, bb: 40 },
  { sb: 40, bb: 80 },
  { sb: 75, bb: 150 },
  { sb: 150, bb: 300 },
  { sb: 300, bb: 600 },
  { sb: 600, bb: 1200 },
]

/** round is 0-indexed. Blinds climb as you bust more dealers. */
export function blindsForRound(round: number): Blinds {
  return BLIND_SCHEDULE[Math.min(round, BLIND_SCHEDULE.length - 1)]
}

/** The dealer comes back hungrier each round. */
export function dealerChipsForRound(round: number): number {
  return Math.round(DEALER_START_CHIPS * (1 + round * 0.6))
}

/** A short, ominous title for the current depth. */
export function roundTitle(round: number): string {
  const titles = [
    'The First Cut',
    'Brass & Bone',
    'The Smiling Gears',
    'Boiler Room',
    'The Long Dark',
    'Clockwork Maw',
    'The Furnace Below',
  ]
  return titles[Math.min(round, titles.length - 1)]
}
