import { describe, it, expect } from 'vitest'
import { createDeck, freshDeck, shuffle } from './deck'
import { evaluateHand, compareHands } from './evaluate'
import {
  startHand,
  applyAction,
  getLegalActions,
  HandState,
} from './holdem'
import { Card } from './types'

const c = (s: string): Card => ({ rank: s[0] as Card['rank'], suit: s[1] as Card['suit'], id: s })

describe('deck', () => {
  it('builds 52 unique cards', () => {
    const deck = createDeck()
    expect(deck).toHaveLength(52)
    expect(new Set(deck.map((d) => d.id)).size).toBe(52)
  })

  it('shuffle is a permutation (deterministic rng)', () => {
    let seed = 42
    const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    const shuffled = shuffle(createDeck(), rng)
    expect(shuffled).toHaveLength(52)
    expect(new Set(shuffled.map((d) => d.id)).size).toBe(52)
  })
})

describe('evaluate', () => {
  it('names a flush', () => {
    const hand = evaluateHand(['As', 'Ks', 'Qs', 'Js', '9s'].map(c))
    expect(hand.name).toBe('Flush')
  })

  it('ranks a full house over a flush', () => {
    const player = [c('Ah'), c('Ad')] // Aces full with the board
    const dealer = [c('2s'), c('7s')] // spade flush with the board
    const board = [c('As'), c('Ks'), c('Qs'), c('Kc'), c('3s')]
    const result = compareHands([...player, ...board], [...dealer, ...board])
    // player: A A A K K (Aces full); dealer: spade flush -> full house wins
    expect(result.player.name).toBe('Full House')
    expect(result.dealer.name).toBe('Flush')
    expect(result.winner).toBe('player')
  })
})

describe('heads-up hand flow', () => {
  it('posts blinds and sets the player to act first pre-flop', () => {
    const s = startHand({ playerChips: 1000, dealerChips: 1000, smallBlind: 10, bigBlind: 20 })
    expect(s.player.hole).toHaveLength(2)
    expect(s.dealer.hole).toHaveLength(2)
    expect(s.pot).toBe(30) // 10 + 20
    expect(s.toAct).toBe('player')
    expect(s.dealerHoleHidden).toBe(true)
  })

  it('lets a fold immediately end the hand and award the pot', () => {
    const s = startHand({ playerChips: 1000, dealerChips: 1000, smallBlind: 10, bigBlind: 20 })
    const after = applyAction(s, 'player', 'fold')
    expect(after.street).toBe('complete')
    expect(after.result?.winner).toBe('dealer')
    expect(after.result?.reason).toBe('fold')
  })

  it('plays preflop-call then both check through to showdown', () => {
    let s: HandState = startHand({ playerChips: 1000, dealerChips: 1000, smallBlind: 10, bigBlind: 20 })
    s = applyAction(s, 'player', 'call') // player completes SB to 20
    expect(s.toAct).toBe('dealer') // big blind gets the option
    s = applyAction(s, 'dealer', 'check') // -> flop
    expect(s.street).toBe('flop')
    expect(s.community).toHaveLength(3)

    // check the flop, turn, river down
    const checkStreet = () => {
      s = applyAction(s, 'dealer', 'check')
      s = applyAction(s, 'player', 'check')
    }
    checkStreet() // turn
    expect(s.street).toBe('turn')
    checkStreet() // river
    expect(s.street).toBe('river')
    s = applyAction(s, 'dealer', 'check')
    s = applyAction(s, 'player', 'check')
    expect(s.street).toBe('complete')
    expect(s.result?.reason).toBe('showdown')
    expect(s.dealerHoleHidden).toBe(false)
  })

  it('never lets a seat commit more than the opponent can match', () => {
    let s: HandState = startHand({ playerChips: 100, dealerChips: 1000, smallBlind: 10, bigBlind: 20 })
    s = applyAction(s, 'player', 'allin') // player shoves 100 total
    const legal = getLegalActions(s, 'dealer')
    // dealer can call but the effective amount is capped at the player's stack
    s = applyAction(s, 'dealer', 'call')
    expect(s.pot).toBeLessThanOrEqual(200)
    expect(s.player.totalCommitted).toBe(s.dealer.totalCommitted)
  })
})
