import { describe, it, expect } from 'vitest'
import { Card } from '../engine/types'
import {
  startHand,
  applyAction,
  getLegalActions,
  forceFold,
  HandState,
  HandResult,
} from '../engine/holdem'
import { decideDealerAction, DealerContext } from '../engine/dealerAI'
import { getCreature, CREATURES } from '../content/creatures'
import {
  aggregateCharms,
  encounterSeed,
  computeHandEffects,
  applySear,
  applyIronWill,
  applyHex,
  ritualUsable,
} from './modifiers'
import { generateMap, MAP_DEPTH } from './map'

const c = (s: string): Card => ({ rank: s[0] as Card['rank'], suit: s[1] as Card['suit'], id: s })

// A deterministic RNG (constant) — handy for forcing AI branches.
const constRng = (v: number) => () => v

describe('charm aggregation', () => {
  it('sums numeric effects and ORs flags', () => {
    const agg = aggregateCharms(['emberChip', 'gamblersHeart', 'ironTell'])
    // emberChip +250 player / +200 dealer; gamblersHeart -150 player / +1 life
    expect(agg.startChips).toBe(250 - 150)
    expect(agg.dealerStartChips).toBe(200)
    expect(agg.maxLivesDelta).toBe(1)
    expect(agg.tellAura).toBe(true)
  })
})

describe('encounter seeding', () => {
  it('applies chip-lead creatures and charm start chips', () => {
    const hoarder = getCreature('hoarder') // chipLead 1.8
    const seed = encounterSeed(0, aggregateCharms(['emberChip']), hoarder)
    // player base 1000 + ember 250; dealer base 1000 * 1.8 + ember dealer 200
    expect(seed.player).toBe(1250)
    expect(seed.dealer).toBe(Math.round(1000 * 1.8) + 200)
  })
})

describe('hand-resolution effects', () => {
  const fakeHand = (playerChips: number, dealerChips: number) =>
    ({ player: { chips: playerChips }, dealer: { chips: dealerChips } } as unknown as HandState)

  it('rake voids a fraction of the pot from the winner', () => {
    const tithe = getCreature('tithe') // rake 0.10
    const result: HandResult = { winner: 'player', reason: 'showdown', potWon: 1000, playerHandName: 'Pair' }
    const eff = computeHandEffects(fakeHand(1000, 1000), result, {}, tithe)
    expect(eff.playerChipDelta).toBe(-100)
  })

  it('Bone Ante pays a premium on big showdown wins only', () => {
    const gambler = getCreature('gambler')
    const agg = aggregateCharms(['boneAnte'])
    const big: HandResult = { winner: 'player', reason: 'showdown', potWon: 1000, playerHandName: 'Flush' }
    const small: HandResult = { winner: 'player', reason: 'showdown', potWon: 1000, playerHandName: 'Pair' }
    expect(computeHandEffects(fakeHand(1000, 1000), big, agg, gambler).playerChipDelta).toBe(400)
    expect(computeHandEffects(fakeHand(1000, 1000), small, agg, gambler).playerChipDelta).toBe(0)
  })

  it('the Vein-Drinker leeches a soul on a showdown it wins', () => {
    const leech = getCreature('leech') // soulLeech 1
    const result: HandResult = { winner: 'dealer', reason: 'showdown', potWon: 500, dealerHandName: 'Two Pair' }
    const eff = computeHandEffects(fakeHand(500, 1500), result, {}, leech)
    expect(eff.soulDelta).toBe(-1)
  })

  it('Vein Tap drains the loser of a showdown (both directions)', () => {
    const gambler = getCreature('gambler')
    const agg = aggregateCharms(['veinTap']) // 0.06
    const win: HandResult = { winner: 'player', reason: 'showdown', potWon: 400, playerHandName: 'Pair' }
    const lose: HandResult = { winner: 'dealer', reason: 'showdown', potWon: 400, dealerHandName: 'Pair' }
    expect(computeHandEffects(fakeHand(1000, 1000), win, agg, gambler).dealerChipDelta).toBe(-60)
    expect(computeHandEffects(fakeHand(1000, 1000), lose, agg, gambler).playerChipDelta).toBe(-60)
  })
})

describe('engine forceFold (Hex backbone)', () => {
  it('makes the named seat fold and awards the pot', () => {
    const s = startHand({ playerChips: 1000, dealerChips: 1000, smallBlind: 10, bigBlind: 20 })
    const after = forceFold(s, 'dealer')
    expect(after.street).toBe('complete')
    expect(after.result?.winner).toBe('player')
    expect(after.result?.reason).toBe('fold')
  })
})

describe('rituals (pure transforms)', () => {
  it('Sear replaces one hole card and keeps two', () => {
    const s = startHand({ playerChips: 1000, dealerChips: 1000, smallBlind: 10, bigBlind: 20 })
    const before = s.player.hole[0].id
    const after = applySear(s, 0)
    expect(after.player.hole).toHaveLength(2)
    expect(after.player.hole[0].id).not.toBe(before)
  })

  it('Hex folds a weak creature but not a strong one', () => {
    const weak = startHand({ playerChips: 1000, dealerChips: 1000, smallBlind: 10, bigBlind: 20 })
    weak.dealer.hole = [c('7h'), c('2d')]
    weak.community = []
    expect(applyHex(weak).worked).toBe(true)

    const strong = startHand({ playerChips: 1000, dealerChips: 1000, smallBlind: 10, bigBlind: 20 })
    strong.dealer.hole = [c('Ah'), c('Ad')]
    strong.community = []
    expect(applyHex(strong).worked).toBe(false)
  })

  it('Iron Will refunds the creature\'s bet so the player can check', () => {
    const s = startHand({ playerChips: 1000, dealerChips: 1000, smallBlind: 10, bigBlind: 20 })
    // Pre-flop the player (SB) faces the big blind — a live bet to refuse.
    expect(ritualUsable('ironWill', s)).toBe(true)
    const dealerBefore = s.dealer.chips
    const next = applyIronWill(s)
    expect(getLegalActions(next, 'player').canCheck).toBe(true)
    expect(next.dealer.chips).toBe(dealerBefore + 10) // the uncalled 10 slides back
  })
})

describe('dealer AI personalities', () => {
  it('a value-only creature never raises a weak hand it could check', () => {
    let s: HandState = startHand({ playerChips: 1000, dealerChips: 1000, smallBlind: 10, bigBlind: 20 })
    s = applyAction(s, 'player', 'call') // dealer (BB) now has the option, no bet to face
    s.dealer.hole = [c('7h'), c('2d')]
    s.community = [c('Ks'), c('9c'), c('4d')]
    const ctx: DealerContext = {
      profile: CREATURES.hoarder.profile,
      sight: 'none',
      playerWasAggressive: false,
    }
    expect(decideDealerAction(s, ctx, constRng(0.99)).action).toBe('check')
  })

  it('river clairvoyance checks a strong hand it secretly knows is beaten', () => {
    // Walk to the river with checks so it's the dealer's turn, no bet posted.
    let s: HandState = startHand({ playerChips: 1000, dealerChips: 1000, smallBlind: 10, bigBlind: 20 })
    s = applyAction(s, 'player', 'call')
    s = applyAction(s, 'dealer', 'check') // flop, dealer to act
    s = applyAction(s, 'dealer', 'check')
    s = applyAction(s, 'player', 'check') // turn, dealer to act
    s = applyAction(s, 'dealer', 'check')
    s = applyAction(s, 'player', 'check') // river, dealer to act
    expect(s.street).toBe('river')
    expect(s.toAct).toBe('dealer')

    // Dealer has a flush; player secretly has a full house (a better hand).
    s.community = [c('As'), c('Ks'), c('7s'), c('5h'), c('5d')]
    s.dealer.hole = [c('Qs'), c('Js')]
    s.player.hole = [c('5c'), c('Ah')]

    const seeing: DealerContext = { profile: CREATURES.jester.profile, sight: 'river', playerWasAggressive: false }
    const blind: DealerContext = { profile: CREATURES.jester.profile, sight: 'none', playerWasAggressive: false }
    // Knowing it's beaten, it checks; blind to that, it value-bets the flush.
    expect(decideDealerAction(s, seeing, constRng(0)).action).toBe('check')
    expect(decideDealerAction(s, blind, constRng(0)).action).toBe('raise')
  })
})

describe('run map generation', () => {
  it('builds a descent that ends in a single boss node', () => {
    const map = generateMap(constRng(0.3))
    expect(map.columns).toHaveLength(MAP_DEPTH + 1)
    const last = map.columns[map.columns.length - 1]
    expect(last).toHaveLength(1)
    expect(last[0].type).toBe('boss')
    // The opening column offers only ordinary dealers.
    expect(map.columns[0].every((n) => n.type === 'dealer')).toBe(true)
  })
})
