// Rituals — active abilities the player triggers mid-hand at the cost of souls
// (Inscryption's table-side rituals; the tactical layer over the betting). You
// OWN rituals (found or bought) but every use spends scarce souls, so the economy
// itself is the universal counter: you can never spam them. Several also have a
// hard limit (once per hand) or a creature that shrugs them off.
//
// The data here is declarative; the pure HandState transforms and the
// "is this legal right now?" checks live in run/modifiers.ts.

export type RitualKind =
  | 'glimpse' // reveal both dealer hole cards for the rest of the hand
  | 'sear' // discard one of your hole cards, draw a random replacement
  | 'cinder' // re-deal the flop (only right as the flop lands)
  | 'ironWill' // refuse the creature's bet this street — push the hand on
  | 'bloodAnte' // convert souls straight into chips
  | 'hex' // force the creature to fold a weak hand (wasted on a strong one)

export interface Ritual {
  id: string
  name: string
  flavor: string
  /** The honest limitation / counter, surfaced to the player. */
  limitation: string
  /** Souls spent per use. */
  cost: number
  kind: RitualKind
  /** True if the player must choose a target hole card (e.g. Sear). */
  needsTarget?: boolean
}

export const RITUALS: Record<string, Ritual> = {
  glimpse: {
    id: 'glimpse',
    name: 'Glimpse',
    flavor: 'Pour a little blood on the felt and the creature\'s cards turn face-up to you alone.',
    limitation: 'Costs 3 souls, and the Jester can still rewrite the river beneath your certainty.',
    cost: 3,
    kind: 'glimpse',
  },

  sear: {
    id: 'sear',
    name: 'Sear',
    flavor: 'Burn one of your hole cards to ash and draw a fresh one from the deck.',
    limitation: 'The replacement is random — it can be worse. Once per hand.',
    cost: 2,
    kind: 'sear',
    needsTarget: true,
  },

  cinder: {
    id: 'cinder',
    name: 'Cinder the Flop',
    flavor: 'Sweep the flop into the furnace and deal three new cards.',
    limitation: 'Only as the flop lands, and the new board can betray you too. Once per hand.',
    cost: 4,
    kind: 'cinder',
  },

  ironWill: {
    id: 'ironWill',
    name: 'Iron Will',
    flavor: 'Refuse the creature\'s bet. Its chips slide back and the street runs on to the next card.',
    limitation: 'Cannot stop an all-in shove, and only once per hand.',
    cost: 3,
    kind: 'ironWill',
  },

  bloodAnte: {
    id: 'bloodAnte',
    name: 'Blood Ante',
    flavor: 'Spend souls to conjure chips onto your stack — a desperate lifeline.',
    limitation: 'One way only, and souls are far harder to find than chips.',
    cost: 5,
    kind: 'bloodAnte',
  },

  hex: {
    id: 'hex',
    name: 'Hex',
    flavor: 'Whisper a name the creature fears. If its hand is weak, it folds at once.',
    limitation: 'Does nothing to a strong hand — the souls burn for naught. Once per hand.',
    cost: 4,
    kind: 'hex',
  },
}

export const RITUAL_IDS = Object.keys(RITUALS)

export function getRitual(id: string): Ritual {
  return RITUALS[id]
}

/** Pick `n` distinct ritual ids the player does not already own. Pure given rng. */
export function offerRituals(
  owned: string[],
  n: number,
  rng: () => number = Math.random,
): string[] {
  const available = RITUAL_IDS.filter((id) => !owned.includes(id))
  const shuffled = available.slice()
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, n)
}
