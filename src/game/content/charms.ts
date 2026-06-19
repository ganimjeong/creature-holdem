// Charms — passive relics the player collects between rounds (Slay-the-Spire
// relics / Balatro jokers). A charm bends the run in your favor, but the design
// rule holds: every charm carries a built-in cost, a conditional trigger, or a
// creature that hard-counters it. There is no free lunch on this felt.
//
// Charms describe their effect as plain data in `effect`; run/modifiers.ts is the
// single place that reads those fields and applies them. Keeping the data here
// declarative makes the whole economy legible and easy to balance.

export interface CharmEffect {
  /** Flat chips added to YOUR stack at the start of each round. */
  startChips?: number
  /** Flat chips added to the DEALER's stack at round start (a downside). */
  dealerStartChips?: number
  /** Change to your maximum lives. */
  maxLivesDelta?: number
  /** Souls granted each time a round is cleared. */
  soulsPerRound?: number
  /** On a showdown you WIN, multiply the pot won by (1 + this). */
  showdownWinBonus?: number
  /** ...but only when your winning hand is named this or better. */
  winBonusMinHand?: string
  /** On a showdown you LOSE, also forfeit this fraction of your remaining stack. */
  showdownLossPenalty?: number
  /** Vampiric: on a showdown win, drain this fraction of the dealer's stack. */
  drainOnWin?: number
  /** ...and the same fraction of YOURS is drained on a showdown loss (the counter). */
  drainSelfOnLoss?: number
  /** Reveal this many flop cards to you during preflop betting (info edge). */
  earlyFlopPeek?: number
  /** Chance each hand to glimpse a dealer hole card; on a miss IT glimpses one of yours. */
  veilChance?: number
  /** When the creature bets, sense a vague strong/weak aura (a tell meter). */
  tellAura?: boolean
}

export type Rarity = 'common' | 'rare' | 'cursed'

export interface Charm {
  id: string
  name: string
  flavor: string
  /** The honest cost / counter, surfaced to the player. */
  downside: string
  rarity: Rarity
  /** Soul price when offered in the shop. */
  cost: number
  effect: CharmEffect
}

export const CHARMS: Record<string, Charm> = {
  boneAnte: {
    id: 'boneAnte',
    name: 'Bone Ante',
    flavor: 'A die carved from a knuckle. Premium showdown wins pay 40% more.',
    downside: 'High variance — losing a showdown also costs you an extra 10% of your stack.',
    rarity: 'rare',
    cost: 7,
    effect: { showdownWinBonus: 0.4, winBonusMinHand: 'Flush', showdownLossPenalty: 0.1 },
  },

  gamblersHeart: {
    id: 'gamblersHeart',
    name: "Gambler's Heart",
    flavor: 'A fourth heart, still warm. You can lose one more life before the dark takes you.',
    downside: 'You sit down 150 chips poorer at the start of every round.',
    rarity: 'rare',
    cost: 8,
    effect: { maxLivesDelta: 1, startChips: -150 },
  },

  emberChip: {
    id: 'emberChip',
    name: 'Ember Chip',
    flavor: 'A coin that never cools. You start each round with +250 chips.',
    downside: 'The creature is fed too — it starts each round with +200 chips.',
    rarity: 'common',
    cost: 5,
    effect: { startChips: 250, dealerStartChips: 200 },
  },

  veinTap: {
    id: 'veinTap',
    name: 'Vein Tap',
    flavor: 'A brass needle for the felt. Win a showdown and drain 6% of the creature\'s stack.',
    downside: 'It bites both ways — lose a showdown and it drains 6% of yours. Useless vs creatures that never show down.',
    rarity: 'rare',
    cost: 7,
    effect: { drainOnWin: 0.06, drainSelfOnLoss: 0.06 },
  },

  soulCoin: {
    id: 'soulCoin',
    name: 'Soul Coin',
    flavor: 'It hums when souls are near. +2 souls every round you clear.',
    downside: 'Greed answers greed — the creature starts each round with +120 chips.',
    rarity: 'common',
    cost: 5,
    effect: { soulsPerRound: 2, dealerStartChips: 120 },
  },

  crackedLens: {
    id: 'crackedLens',
    name: 'Cracked Lens',
    flavor: 'A monocle with a hairline fracture. See one flop card during the preflop betting.',
    downside: 'The Watcher reads one of yours in return, and it never helps you when you must fold preflop.',
    rarity: 'rare',
    cost: 6,
    effect: { earlyFlopPeek: 1 },
  },

  widowsVeil: {
    id: 'widowsVeil',
    name: "Widow's Veil",
    flavor: 'Lace that remembers every face. 1 in 4 hands you glimpse a dealer hole card.',
    downside: 'On the other hands the veil thins the wrong way — the creature glimpses one of YOURS.',
    rarity: 'cursed',
    cost: 6,
    effect: { veilChance: 0.25 },
  },

  ironTell: {
    id: 'ironTell',
    name: 'Iron Tell',
    flavor: 'A gauge that twitches at lies. When the creature bets, sense if it is strong or weak.',
    downside: 'The Watcher and the Jester feed it false readings — trust it least when it matters most.',
    rarity: 'common',
    cost: 5,
    effect: { tellAura: true },
  },
}

export const CHARM_IDS = Object.keys(CHARMS)

export function getCharm(id: string): Charm {
  return CHARMS[id]
}

/** Pick `n` distinct charm ids the player does not already own. Pure given rng. */
export function offerCharms(
  owned: string[],
  n: number,
  rng: () => number = Math.random,
): string[] {
  const available = CHARM_IDS.filter((id) => !owned.includes(id))
  const shuffled = available.slice()
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, n)
}
