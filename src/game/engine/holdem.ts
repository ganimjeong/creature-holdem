// Heads-up (1 vs 1) Texas Hold'em betting engine — pure, framework-free.
//
// Scope for the vertical slice: a correct single-hand state machine for two
// seats (the player and the creature dealer). The human player always holds the
// button: they post the small blind and act first pre-flop; the dealer (big
// blind) acts first on every later street, exactly as real heads-up play works.
//
// All functions are pure: they take a HandState and return a new one. Pacing,
// timers, and the dealer's "thinking" delay live in the store, not here.

import { Card } from './types'
import { freshDeck } from './deck'
import { compareHands, Showdown } from './evaluate'

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'complete'
export type Seat = 'player' | 'dealer'
export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'allin'

export interface SeatState {
  chips: number
  hole: Card[]
  /** Chips committed on the current street. */
  committed: number
  /** Chips committed across the whole hand (drives the pot). */
  totalCommitted: number
  folded: boolean
  allIn: boolean
  /** Has this seat acted at least once on the current street? */
  actedThisStreet: boolean
}

export interface HandResult {
  winner: Seat | 'split'
  reason: 'fold' | 'showdown'
  potWon: number
  playerHandName?: string
  dealerHandName?: string
  /** Codes of the 5 cards that made the winning hand (showdown only). */
  winningCards?: string[]
  showdown?: Showdown
}

export interface HandState {
  street: Street
  deck: Card[]
  community: Card[]
  /** How many community cards are face-up (for staged reveals). */
  revealedCommunity: number
  player: SeatState
  dealer: SeatState
  pot: number
  smallBlind: number
  bigBlind: number
  /** Highest committed amount on the current street. */
  currentBet: number
  /** Size of the last bet/raise increment (for min-raise rules). */
  lastRaiseSize: number
  toAct: Seat | null
  dealerHoleHidden: boolean
  result?: HandResult
  log: string[]
}

export interface LegalActions {
  canFold: boolean
  canCheck: boolean
  canCall: boolean
  /** Chips required to call. */
  callAmount: number
  canRaise: boolean
  /** Minimum total this-street commitment a raise must reach. */
  minRaiseTo: number
  /** Maximum total this-street commitment (all-in shove). */
  maxRaiseTo: number
}

function emptySeat(chips: number): SeatState {
  return {
    chips,
    hole: [],
    committed: 0,
    totalCommitted: 0,
    folded: false,
    allIn: false,
    actedThisStreet: false,
  }
}

export interface StartHandOptions {
  playerChips: number
  dealerChips: number
  smallBlind: number
  bigBlind: number
  rng?: () => number
}

/** Deal a new hand: post blinds, deal two hole cards each, set first to act. */
export function startHand(opts: StartHandOptions): HandState {
  const deck = freshDeck(opts.rng)
  const player = emptySeat(opts.playerChips)
  const dealer = emptySeat(opts.dealerChips)

  // Deal hole cards (player, dealer, player, dealer).
  player.hole.push(deck.pop()!)
  dealer.hole.push(deck.pop()!)
  player.hole.push(deck.pop()!)
  dealer.hole.push(deck.pop()!)

  const state: HandState = {
    street: 'preflop',
    deck,
    community: [],
    revealedCommunity: 0,
    player,
    dealer,
    pot: 0,
    smallBlind: opts.smallBlind,
    bigBlind: opts.bigBlind,
    currentBet: 0,
    lastRaiseSize: opts.bigBlind,
    toAct: 'player',
    dealerHoleHidden: true,
    log: [],
  }

  // Post blinds: player (button) = small blind, dealer = big blind.
  postBlind(state, 'player', opts.smallBlind)
  postBlind(state, 'dealer', opts.bigBlind)
  state.currentBet = opts.bigBlind
  state.lastRaiseSize = opts.bigBlind
  // Blinds are forced, not voluntary actions: keep actedThisStreet false so the
  // big blind still gets their option to check or raise.
  state.player.actedThisStreet = false
  state.dealer.actedThisStreet = false
  state.toAct = 'player'
  log(state, `Blinds posted — SB ${opts.smallBlind} / BB ${opts.bigBlind}.`)
  return state
}

function postBlind(state: HandState, seat: Seat, amount: number) {
  const s = state[seat]
  const put = Math.min(amount, s.chips)
  s.chips -= put
  s.committed += put
  s.totalCommitted += put
  state.pot += put
  if (s.chips === 0) s.allIn = true
}

function other(seat: Seat): Seat {
  return seat === 'player' ? 'dealer' : 'player'
}

function log(state: HandState, msg: string) {
  state.log.push(msg)
}

/** Largest amount `seat` can usefully commit (capped by the opponent's stack). */
function effectiveCap(state: HandState, seat: Seat): number {
  const opp = state[other(seat)]
  // You can never win more than the opponent can match.
  return opp.totalCommitted + opp.chips
}

export function getLegalActions(state: HandState, seat: Seat): LegalActions {
  const s = state[seat]
  if (state.toAct !== seat || s.folded || s.allIn || state.street === 'showdown' || state.street === 'complete') {
    return {
      canFold: false, canCheck: false, canCall: false, callAmount: 0,
      canRaise: false, minRaiseTo: 0, maxRaiseTo: 0,
    }
  }

  const toCall = Math.max(0, state.currentBet - s.committed)
  const callAmount = Math.min(toCall, s.chips)
  const canCheck = toCall === 0
  const canCall = toCall > 0

  // Raising: must reach at least currentBet + lastRaiseSize, capped by stack and
  // by the opponent's effective stack.
  const cap = effectiveCap(state, seat)
  const maxRaiseTo = Math.min(s.committed + s.chips, cap)
  const minRaiseTo = Math.min(state.currentBet + state.lastRaiseSize, maxRaiseTo)
  const canRaise = maxRaiseTo > state.currentBet

  return {
    canFold: toCall > 0, // folding when you could check for free is pointless
    canCheck,
    canCall,
    callAmount,
    canRaise,
    minRaiseTo,
    maxRaiseTo,
  }
}

/**
 * Apply an action for the seat to act. `raiseTo` is the target total committed
 * on this street (only used for 'raise'). Returns a new HandState.
 */
export function applyAction(
  prev: HandState,
  seat: Seat,
  action: ActionType,
  raiseTo?: number,
): HandState {
  // Clone (shallow on top, fresh seat objects) so callers stay immutable.
  const state: HandState = {
    ...prev,
    player: { ...prev.player, hole: prev.player.hole.slice() },
    dealer: { ...prev.dealer, hole: prev.dealer.hole.slice() },
    community: prev.community.slice(),
    deck: prev.deck.slice(),
    log: prev.log.slice(),
  }
  if (state.toAct !== seat) return state
  const s = state[seat]
  const name = seat === 'player' ? 'You' : 'The Dealer'

  switch (action) {
    case 'fold': {
      s.folded = true
      log(state, `${name} folds.`)
      finishByFold(state, other(seat))
      return state
    }
    case 'check': {
      const toCall = state.currentBet - s.committed
      if (toCall > 0) return state // illegal; ignore
      s.actedThisStreet = true
      log(state, `${name} checks.`)
      break
    }
    case 'call': {
      const toCall = Math.max(0, state.currentBet - s.committed)
      const put = Math.min(toCall, s.chips)
      commit(state, seat, put)
      s.actedThisStreet = true
      log(state, `${name} calls ${put}.`)
      break
    }
    case 'allin': {
      const put = Math.min(s.chips, Math.max(0, effectiveCap(state, seat) - s.committed))
      const target = s.committed + put
      commit(state, seat, put)
      s.actedThisStreet = true
      if (target > state.currentBet) {
        state.lastRaiseSize = Math.max(state.lastRaiseSize, target - state.currentBet)
        state.currentBet = target
        state[other(seat)].actedThisStreet = false
      }
      log(state, `${name} goes all-in for ${put}.`)
      break
    }
    case 'raise': {
      const target = clampRaise(state, seat, raiseTo ?? 0)
      const put = target - s.committed
      commit(state, seat, put)
      s.actedThisStreet = true
      state.lastRaiseSize = target - state.currentBet
      state.currentBet = target
      // A raise re-opens the action for the opponent.
      state[other(seat)].actedThisStreet = false
      log(state, `${name} raises to ${target}.`)
      break
    }
  }

  advance(state)
  return state
}

function clampRaise(state: HandState, seat: Seat, raiseTo: number): number {
  const { minRaiseTo, maxRaiseTo } = getLegalActions(state, seat)
  return Math.max(minRaiseTo, Math.min(maxRaiseTo, raiseTo))
}

function commit(state: HandState, seat: Seat, amount: number) {
  const s = state[seat]
  const put = Math.min(amount, s.chips)
  s.chips -= put
  s.committed += put
  s.totalCommitted += put
  state.pot += put
  if (s.chips === 0) s.allIn = true
}

function finishByFold(state: HandState, winner: Seat) {
  refundUncalled(state)
  const potWon = state.pot
  state[winner].chips += potWon
  state.street = 'complete'
  state.toAct = null
  state.result = {
    winner,
    reason: 'fold',
    potWon,
  }
  log(state, `${winner === 'player' ? 'You win' : 'The Dealer wins'} ${potWon} (fold).`)
}

/** Return chips that the opponent could not match (uncalled portion). */
function refundUncalled(state: HandState) {
  const diff = state.player.committed - state.dealer.committed
  if (diff > 0) {
    state.player.chips += diff
    state.player.committed -= diff
    state.player.totalCommitted -= diff
    state.pot -= diff
  } else if (diff < 0) {
    const d = -diff
    state.dealer.chips += d
    state.dealer.committed -= d
    state.dealer.totalCommitted -= d
    state.pot -= d
  }
}

/** Decide whether the street is complete and move the game forward. */
function advance(state: HandState) {
  const p = state.player
  const d = state.dealer

  const bettingMatched = p.committed === d.committed
  const bothActed = p.actedThisStreet && d.actedThisStreet
  const someoneAllIn = p.allIn || d.allIn

  // If both are all-in (or one all-in and the other has matched), run it out.
  if (someoneAllIn && bettingMatched && (p.allIn || d.allIn)) {
    if (p.allIn && (d.allIn || d.committed >= p.committed)) {
      return runOutAndShowdown(state)
    }
  }

  const streetDone = bettingMatched && (bothActed || (someoneAllIn && bettingMatched))

  if (!streetDone) {
    state.toAct = other(state.toAct ?? 'player')
    // If the next seat can't act (all-in/folded), keep running out.
    const next = state[state.toAct]
    if (next.folded || next.allIn) {
      if (bettingMatched) return runOutAndShowdown(state)
    }
    return
  }

  nextStreet(state)
}

function nextStreet(state: HandState) {
  // Reset per-street betting.
  state.player.committed = 0
  state.dealer.committed = 0
  state.player.actedThisStreet = false
  state.dealer.actedThisStreet = false
  state.currentBet = 0
  state.lastRaiseSize = state.bigBlind

  switch (state.street) {
    case 'preflop':
      dealCommunity(state, 3) // flop
      state.street = 'flop'
      break
    case 'flop':
      dealCommunity(state, 1) // turn
      state.street = 'turn'
      break
    case 'turn':
      dealCommunity(state, 1) // river
      state.street = 'river'
      break
    case 'river':
      return doShowdown(state)
    default:
      return
  }
  // Post-flop: the non-button seat (dealer / big blind) acts first.
  state.toAct = 'dealer'
  // If a seat is all-in there is no more betting; run out the rest.
  if (state.player.allIn || state.dealer.allIn) {
    runOutAndShowdown(state)
  }
}

function runOutAndShowdown(state: HandState) {
  // Deal whatever community cards remain, then resolve.
  while (state.community.length < 5) {
    const need = state.community.length === 0 ? 3 : 1
    dealCommunity(state, need)
  }
  doShowdown(state)
}

function dealCommunity(state: HandState, count: number) {
  for (let i = 0; i < count; i++) {
    state.community.push(state.deck.pop()!)
  }
  state.revealedCommunity = state.community.length
}

function doShowdown(state: HandState) {
  refundUncalled(state)
  state.street = 'showdown'
  state.toAct = null
  state.dealerHoleHidden = false

  const playerCards = [...state.player.hole, ...state.community]
  const dealerCards = [...state.dealer.hole, ...state.community]
  const result = compareHands(playerCards, dealerCards)

  const potWon = state.pot
  if (result.winner === 'player') {
    state.player.chips += potWon
  } else if (result.winner === 'dealer') {
    state.dealer.chips += potWon
  } else {
    const half = Math.floor(potWon / 2)
    state.player.chips += half
    state.dealer.chips += potWon - half
  }

  // The five cards to spotlight: the winner's best hand (player's on a split).
  const winnerStrength = result.winner === 'dealer' ? result.dealer : result.player
  state.result = {
    winner: result.winner,
    reason: 'showdown',
    potWon,
    playerHandName: result.player.name,
    dealerHandName: result.dealer.name,
    winningCards: winnerStrength.cards,
    showdown: result,
  }
  state.street = 'complete'
  log(
    state,
    `Showdown — You: ${result.player.name} vs Dealer: ${result.dealer.name}.`,
  )
}
