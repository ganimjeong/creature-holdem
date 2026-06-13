// Central game store (zustand). This is the single contract the 3D scene and the
// HTML UI both read from. It owns the run-level state (lives, round, blinds),
// the current hand (delegated to the pure engine), and drives the creature
// dealer's turns on a dramatic timer.

import { create } from 'zustand'
import {
  HandState,
  HandResult,
  ActionType,
  Seat,
  startHand as engineStartHand,
  applyAction as engineApplyAction,
  getLegalActions,
  LegalActions,
} from '../engine/holdem'
import { decideDealerAction } from '../engine/dealerAI'
import {
  STARTING_LIVES,
  PLAYER_START_CHIPS,
  COMEBACK_CHIPS,
  blindsForRound,
  dealerChipsForRound,
} from '../run/roguelike'

export type RunPhase = 'menu' | 'playing' | 'gameover' | 'victory'

/** Transient visual-effect pulse. Components watch `fx.id` and fire on change. */
export type FxType =
  | 'deal'
  | 'win'
  | 'lose'
  | 'bigHand'
  | 'allin'
  | 'roundWin'
  | 'death'

export interface FxPulse {
  type: FxType
  id: number
}

export interface GameState {
  // ---- run-level ----
  phase: RunPhase
  lives: number
  round: number
  /** Hands played this run (for flavor / scoring). */
  handsPlayed: number

  // ---- current hand ----
  hand: HandState | null
  isDealerThinking: boolean
  /** Result of the most recently completed hand (drives result UI + FX). */
  lastResult: HandResult | null

  // ---- presentation ----
  message: string
  fx: FxPulse | null

  // ---- actions ----
  startRun: () => void
  startNextHand: () => void
  /** Player chooses an action; `raiseTo` is the target street commitment. */
  playerAction: (action: ActionType, raiseTo?: number) => void
  /** Advance the run after a hand resolves (apply life/round transitions). */
  continueRun: () => void
  backToMenu: () => void
  /** Convenience selector used by the betting UI. */
  legalActions: (seat: Seat) => LegalActions | null
}

const DEALER_MIN_THINK = 850
const DEALER_MAX_THINK = 1700

let fxCounter = 0
function pulse(type: FxType): FxPulse {
  return { type, id: ++fxCounter }
}

export const useGame = create<GameState>((set, get) => {
  // --- internal helpers (closure over set/get) ---

  function triggerFx(type: FxType) {
    set({ fx: pulse(type) })
  }

  /** Commit a new hand state and react to it (resolve, or schedule dealer). */
  function applyHandState(next: HandState) {
    set({ hand: next })

    if (next.street === 'complete' && next.result) {
      resolveHand(next.result, next)
      return
    }
    if (next.toAct === 'dealer') {
      scheduleDealerTurn()
    }
  }

  function scheduleDealerTurn() {
    set({ isDealerThinking: true })
    const delay =
      DEALER_MIN_THINK + Math.random() * (DEALER_MAX_THINK - DEALER_MIN_THINK)
    window.setTimeout(() => {
      const cur = get().hand
      if (!cur || cur.toAct !== 'dealer' || cur.street === 'complete') {
        set({ isDealerThinking: false })
        return
      }
      const { action, raiseTo } = decideDealerAction(cur)
      if (action === 'allin') triggerFx('allin')
      const next = engineApplyAction(cur, 'dealer', action, raiseTo)
      set({ isDealerThinking: false })
      applyHandState(next)
    }, delay)
  }

  function resolveHand(result: HandResult, finalState: HandState) {
    const playerWon = result.winner === 'player'
    const big =
      result.reason === 'showdown' &&
      result.playerHandName &&
      ['Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'].includes(
        result.playerHandName,
      )

    let message: string
    if (result.winner === 'split') {
      message = `Split pot — ${result.playerHandName ?? ''}.`
    } else if (playerWon) {
      message =
        result.reason === 'fold'
          ? 'The creature folds. You take the pot.'
          : `You win with ${result.playerHandName}.`
    } else {
      message =
        result.reason === 'fold'
          ? 'You fold. The creature drags the pot in.'
          : `The creature wins with ${result.dealerHandName}.`
    }

    set({ lastResult: result, message })

    if (playerWon) triggerFx(big ? 'bigHand' : 'win')
    else if (result.winner === 'dealer') triggerFx('lose')
  }

  return {
    phase: 'menu',
    lives: STARTING_LIVES,
    round: 0,
    handsPlayed: 0,
    hand: null,
    isDealerThinking: false,
    lastResult: null,
    message: '',
    fx: null,

    startRun: () => {
      set({
        phase: 'playing',
        lives: STARTING_LIVES,
        round: 0,
        handsPlayed: 0,
        lastResult: null,
        message: 'The creature deals. Survive.',
      })
      get().startNextHand()
    },

    startNextHand: () => {
      const state = get()
      const prev = state.hand
      const blinds = blindsForRound(state.round)

      // Carry stacks from the previous hand; seed fresh at run/round start.
      const playerChips = prev ? prev.player.chips : PLAYER_START_CHIPS
      const dealerChips = prev
        ? prev.dealer.chips
        : dealerChipsForRound(state.round)

      const hand = engineStartHand({
        playerChips,
        dealerChips,
        smallBlind: blinds.sb,
        bigBlind: blinds.bb,
      })

      set({
        hand,
        lastResult: null,
        isDealerThinking: false,
        handsPlayed: state.handsPlayed + 1,
        message: 'Your move.',
      })
      triggerFx('deal')

      // Pre-flop the dealer (big blind) acts after the player, so it's the
      // player's turn first. Nothing to schedule here.
      if (hand.toAct === 'dealer') scheduleDealerTurn()
    },

    playerAction: (action, raiseTo) => {
      const cur = get().hand
      if (!cur || cur.toAct !== 'player' || cur.street === 'complete') return
      if (action === 'allin') triggerFx('allin')
      const next = engineApplyAction(cur, 'player', action, raiseTo)
      applyHandState(next)
    },

    continueRun: () => {
      const state = get()
      const hand = state.hand
      if (!hand) return

      const playerChips = hand.player.chips
      const dealerChips = hand.dealer.chips

      // Dealer busted -> round won, dealer returns stronger, blinds climb.
      if (dealerChips <= 0) {
        const nextRound = state.round + 1
        set({
          round: nextRound,
          message: 'The creature is broken... for now. It returns hungrier.',
          // Reset hand so startNextHand reseeds dealer chips for the new round.
          hand: {
            ...hand,
            player: { ...hand.player, chips: playerChips },
            dealer: { ...hand.dealer, chips: dealerChipsForRound(nextRound) },
          },
        })
        triggerFx('roundWin')
        get().startNextHand()
        return
      }

      // Player busted -> lose a life (or die).
      if (playerChips <= 0) {
        const lives = state.lives - 1
        if (lives <= 0) {
          set({ lives: 0, phase: 'gameover' })
          triggerFx('death')
          return
        }
        set({
          lives,
          message: `A life torn away. ${lives} left. Back to the table.`,
          hand: {
            ...hand,
            player: { ...hand.player, chips: COMEBACK_CHIPS },
          },
        })
        get().startNextHand()
        return
      }

      // Normal continuation with carried stacks.
      get().startNextHand()
    },

    backToMenu: () => {
      set({
        phase: 'menu',
        hand: null,
        lastResult: null,
        isDealerThinking: false,
        message: '',
      })
    },

    legalActions: (seat) => {
      const hand = get().hand
      if (!hand) return null
      return getLegalActions(hand, seat)
    },
  }
})
