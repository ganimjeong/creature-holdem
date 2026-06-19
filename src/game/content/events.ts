// Events — the non-combat nodes on the run map (Slay-the-Spire "?" rooms). Each
// is a short, ominous choice with a risk/reward outcome, sometimes a coin flip.
// Outcomes are declarative; the store reads the fields and applies them, so the
// economy (chips/souls/lives) stays in one place.

export interface EventOutcome {
  /** Narration shown after the choice resolves. */
  text: string
  /** Chips granted (or removed) — applied to the next hand's starting stack. */
  chips?: number
  souls?: number
  lives?: number
  /** Grant a random charm the player doesn't own. */
  grantCharm?: boolean
  /** Grant a random ritual the player doesn't own. */
  grantRitual?: boolean
}

export interface EventOption {
  label: string
  /** Souls spent to choose this (the option is locked if unaffordable). */
  costSouls?: number
  /** Chips spent to choose this. */
  costChips?: number
  /** If set, the choice is a gamble: probability of the `win` outcome (else `lose`). */
  chance?: number
  win: EventOutcome
  lose?: EventOutcome
}

export interface GameEvent {
  id: string
  name: string
  flavor: string
  options: EventOption[]
}

export const EVENTS: Record<string, GameEvent> = {
  brassCup: {
    id: 'brassCup',
    name: 'The Brass Cup',
    flavor: 'A dented brass cup steams on the felt, full of something black and slow.',
    options: [
      {
        label: 'Drink',
        chance: 0.5,
        win: { text: 'Warmth floods your chest. A heart you thought lost beats again.', lives: 1 },
        lose: { text: 'It burns all the way down. You cough up the cost in chips.', chips: -300 },
      },
      {
        label: 'Pour it out',
        win: { text: 'You spill it on the floor. Something beneath the boards laps it up, and leaves you a coin.', souls: 1 },
      },
    ],
  },

  whisperingCoin: {
    id: 'whisperingCoin',
    name: 'The Whispering Coin',
    flavor: 'A coin spins on its edge and will not fall. It is whispering your name.',
    options: [
      {
        label: 'Pay it (3 souls)',
        costSouls: 3,
        win: { text: 'You feed it three souls. It stops whispering — and a charm is suddenly in your pocket.', grantCharm: true },
      },
      {
        label: 'Let it spin',
        win: { text: 'You walk past. It is still whispering when the door closes.' },
      },
    ],
  },

  cagedThing: {
    id: 'cagedThing',
    name: 'The Caged Thing',
    flavor: 'Something small and many-jointed rattles a brass cage, watching you with too much hope.',
    options: [
      {
        label: 'Free it (2 souls)',
        costSouls: 2,
        win: { text: 'The lock clicks. It presses a wet, knowing gift into your hand before it scuttles into the dark.', grantRitual: true },
      },
      {
        label: 'Pocket the lock-coins',
        win: { text: 'You pry the brass lock for its coins. The screaming follows you down the hall.', souls: 2 },
      },
    ],
  },

  gamblersBargain: {
    id: 'gamblersBargain',
    name: "The Gambler's Bargain",
    flavor: 'A smaller table waits in an alcove, one chair, one coin, one chance.',
    options: [
      {
        label: 'Wager 200 chips',
        costChips: 200,
        chance: 0.5,
        win: { text: 'The coin lands your way. It pays you back, and then some.', chips: 700 },
        lose: { text: 'The coin lands wrong. The alcove is empty when you look up.' },
      },
      {
        label: 'Walk away',
        win: { text: 'You leave the coin spinning. Some bargains are not meant to be made.' },
      },
    ],
  },

  altarOfTeeth: {
    id: 'altarOfTeeth',
    name: 'The Altar of Teeth',
    flavor: 'A low iron altar set with a ring of yellowed teeth. It is very cold, and very patient.',
    options: [
      {
        label: 'Feed it 200 chips',
        costChips: 200,
        win: { text: 'The teeth grind, satisfied. Four souls coil up from the iron into your hand.', souls: 4 },
      },
      {
        label: 'Lay your hand upon it',
        chance: 0.45,
        win: { text: 'The cold reads you and finds you worthy. A charm crystallises in your palm.', grantCharm: true },
        lose: { text: 'The teeth take a tithe of luck instead. Your purse feels lighter.', chips: -150 },
      },
    ],
  },
}

export const EVENT_IDS = Object.keys(EVENTS)

export function getEvent(id: string): GameEvent {
  return EVENTS[id]
}

/** Pick a random event id. Pure given rng. */
export function pickEvent(rng: () => number = Math.random): string {
  return EVENT_IDS[Math.floor(rng() * EVENT_IDS.length)]
}
