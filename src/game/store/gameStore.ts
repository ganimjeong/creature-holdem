// Central game store (zustand). The single contract the 3D scene and the HTML UI
// both read from. It owns the run meta (lives, souls, owned charms/rituals, the
// map and where you are on it), the active creature encounter, the current hand
// (delegated to the pure engine), and the roguelike effect layer (run/modifiers).
//
// The poker engine stays pure; every roguelike twist — creature abilities, charm
// boons, ritual powers, souls — is applied here through run/modifiers so the rules
// remain testable and the meta-game lives in one auditable place.

import { create } from 'zustand'
import { Card } from '../engine/types'
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
  REST_SCAVENGE_SOULS,
  REST_MEND_LIVES,
  MEND_LIFE_COST,
  REWARD_CHARM_CHOICES,
  maxLivesWith,
} from '../run/roguelike'
import {
  generateMap,
  RunMap,
  MapNode,
} from '../run/map'
import {
  Creature,
  getCreature,
} from '../content/creatures'
import { Charm, getCharm, offerCharms } from '../content/charms'
import { Ritual, getRitual, offerRituals } from '../content/rituals'
import { GameEvent, getEvent, EventOption } from '../content/events'
import {
  aggregateCharms,
  encounterSeed,
  encounterBlinds,
  dealerContextFor,
  computeHandEffects,
  planReveals,
  applySear,
  applyCinder,
  applyIronWill,
  applyBloodAnte,
  applyHex,
  ritualUsable,
} from '../run/modifiers'

export type RunPhase =
  | 'menu'
  | 'map'
  | 'intro'
  | 'playing'
  | 'reward'
  | 'shop'
  | 'event'
  | 'rest'
  | 'gameover'
  | 'victory'

/** Transient visual-effect pulse. Components watch `fx.id` and fire on change. */
export type FxType =
  | 'deal'
  | 'win'
  | 'lose'
  | 'bigHand'
  | 'allin'
  | 'roundWin'
  | 'death'
  | 'ritual'
  | 'victory'

export interface FxPulse {
  type: FxType
  id: number
}

export interface ShopItem {
  kind: 'charm' | 'ritual' | 'mend'
  id?: string
  cost: number
  sold: boolean
}

export interface GameState {
  // ---- run-level ----
  phase: RunPhase
  lives: number
  souls: number
  handsPlayed: number
  /** The descent map and which choice-column we're on. */
  map: RunMap | null
  mapColumn: number
  ownedCharms: string[]
  ownedRituals: string[]
  /** One-shot chip swing (from events) applied to the next encounter's seed. */
  pendingChipBonus: number

  // ---- active encounter ----
  creature: Creature | null
  /** Difficulty index for the current encounter (= map depth). */
  round: number
  handsThisEncounter: number

  // ---- current hand ----
  hand: HandState | null
  isDealerThinking: boolean
  lastResult: HandResult | null
  /** Extra messages from the effect layer for the result panel. */
  effectMessages: string[]

  // ---- per-hand info reveals (presentation) ----
  revealDealerHole: boolean
  creatureSeesPlayer: number | null
  playerSeesDealer: number | null
  peekedFlop: Card[]
  ritualsUsedThisHand: string[]
  playerAggressedThisHand: boolean

  // ---- node screens ----
  rewardCharms: string[]
  shopItems: ShopItem[]
  event: GameEvent | null
  eventResultText: string | null

  // ---- presentation ----
  message: string
  fx: FxPulse | null

  // ---- derived helpers ----
  maxLives: () => number

  // ---- actions ----
  startRun: () => void
  chooseNode: (index: number) => void
  beginEncounter: () => void
  startNextHand: () => void
  playerAction: (action: ActionType, raiseTo?: number) => void
  useRitual: (id: string, targetIndex?: number) => void
  continueRun: () => void
  takeReward: (charmId: string | null) => void
  buyShopItem: (index: number) => void
  leaveShop: () => void
  resolveEvent: (optionIndex: number) => void
  dismissEvent: () => void
  resolveRest: (choice: 'mend' | 'scavenge') => void
  backToMenu: () => void
  legalActions: (seat: Seat) => LegalActions | null
}

const DEALER_MIN_THINK = 850
const DEALER_MAX_THINK = 1700

let fxCounter = 0
function pulse(type: FxType): FxPulse {
  return { type, id: ++fxCounter }
}

const BIG_HANDS = ['Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush']

export const useGame = create<GameState>((set, get) => {
  // --- internal helpers (closure over set/get) ---

  function triggerFx(type: FxType) {
    set({ fx: pulse(type) })
  }

  function charmLivesDelta(): number {
    return aggregateCharms(get().ownedCharms).maxLivesDelta ?? 0
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
      const state = get()
      const cur = state.hand
      const creature = state.creature
      if (!cur || cur.toAct !== 'dealer' || cur.street === 'complete' || !creature) {
        set({ isDealerThinking: false })
        return
      }
      const ctx = dealerContextFor(creature, state.playerAggressedThisHand)
      const { action, raiseTo } = decideDealerAction(cur, ctx)
      if (action === 'allin') triggerFx('allin')
      const next = engineApplyAction(cur, 'dealer', action, raiseTo)
      set({ isDealerThinking: false })
      applyHandState(next)
    }, delay)
  }

  function resolveHand(result: HandResult, finalState: HandState) {
    const state = get()
    const creature = state.creature!
    const agg = aggregateCharms(state.ownedCharms)

    // Apply the effect layer (rake / bonuses / drains / soul leech) on top of the
    // engine's base payout, clamping stacks to non-negative.
    const effects = computeHandEffects(finalState, result, agg, creature)
    const playerChips = Math.max(0, finalState.player.chips + effects.playerChipDelta)
    const dealerChips = Math.max(0, finalState.dealer.chips + effects.dealerChipDelta)
    const souls = Math.max(0, state.souls + effects.soulDelta)

    const adjusted: HandState = {
      ...finalState,
      player: { ...finalState.player, chips: playerChips },
      dealer: { ...finalState.dealer, chips: dealerChips },
    }

    const playerWon = result.winner === 'player'
    const big =
      result.reason === 'showdown' &&
      result.playerHandName !== undefined &&
      BIG_HANDS.includes(result.playerHandName)

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
          : `${creature.name} wins with ${result.dealerHandName}.`
    }

    set({
      hand: adjusted,
      lastResult: result,
      souls,
      effectMessages: effects.messages,
      message,
      // The whole table is laid bare at a showdown.
      revealDealerHole: result.reason === 'showdown' ? true : state.revealDealerHole,
    })

    if (playerWon) triggerFx(big ? 'bigHand' : 'win')
    else if (result.winner === 'dealer') triggerFx('lose')
  }

  /** Lay out a fresh hand for the active creature encounter. */
  function dealHand(seedStacks: boolean) {
    const state = get()
    const creature = state.creature!
    const agg = aggregateCharms(state.ownedCharms)
    const prev = state.hand

    const blinds = encounterBlinds(state.round, creature, state.handsThisEncounter)

    let playerChips: number
    let dealerChips: number
    if (seedStacks || !prev) {
      const seed = encounterSeed(state.round, agg, creature, state.pendingChipBonus)
      playerChips = seed.player
      dealerChips = seed.dealer
    } else {
      playerChips = prev.player.chips
      dealerChips = prev.dealer.chips
    }

    const hand = engineStartHand({
      playerChips,
      dealerChips,
      smallBlind: blinds.sb,
      bigBlind: blinds.bb,
    })

    const reveal = planReveals(hand, agg, creature)

    set({
      hand,
      lastResult: null,
      isDealerThinking: false,
      effectMessages: [],
      handsPlayed: state.handsPlayed + 1,
      handsThisEncounter: state.handsThisEncounter + 1,
      pendingChipBonus: seedStacks || !prev ? 0 : state.pendingChipBonus,
      message: 'Your move.',
      revealDealerHole: false,
      creatureSeesPlayer: reveal.creatureSeesPlayer,
      playerSeesDealer: reveal.playerSeesDealer,
      peekedFlop: reveal.earlyFlop,
      ritualsUsedThisHand: [],
      playerAggressedThisHand: false,
    })
    triggerFx('deal')

    if (hand.toAct === 'dealer') scheduleDealerTurn()
  }

  /** Grant a charm mid-run (rewards/shop/events). +life charms also heal. */
  function grantCharm(id: string) {
    const state = get()
    if (state.ownedCharms.includes(id)) return
    const owned = [...state.ownedCharms, id]
    const livesDelta = getCharm(id)?.effect.maxLivesDelta ?? 0
    set({
      ownedCharms: owned,
      lives: livesDelta > 0 ? state.lives + livesDelta : state.lives,
    })
  }

  function grantRitual(id: string) {
    const state = get()
    if (state.ownedRituals.includes(id)) return
    set({ ownedRituals: [...state.ownedRituals, id] })
  }

  /** Advance to the next choice-column on the map. */
  function advanceMap() {
    const state = get()
    if (!state.map) return
    const next = state.mapColumn + 1
    if (next >= state.map.columns.length) {
      set({ phase: 'victory' })
      triggerFx('victory')
      return
    }
    set({ mapColumn: next, phase: 'map', message: '' })
  }

  function startEncounterWith(creatureId: string) {
    const creature = getCreature(creatureId)
    set({
      creature,
      handsThisEncounter: 0,
      hand: null,
      lastResult: null,
      phase: 'intro',
      message: creature.flavor,
    })
  }

  function openShop() {
    const state = get()
    const charmOffers = offerCharms(state.ownedCharms, 2)
    const ritualOffers = offerRituals(state.ownedRituals, 2)
    const items: ShopItem[] = [
      ...charmOffers.map((id) => ({ kind: 'charm' as const, id, cost: getCharm(id).cost, sold: false })),
      ...ritualOffers.map((id) => ({ kind: 'ritual' as const, id, cost: getRitual(id).cost, sold: false })),
    ]
    if (state.lives < state.maxLives()) {
      items.push({ kind: 'mend', cost: MEND_LIFE_COST, sold: false })
    }
    set({ shopItems: items, phase: 'shop', message: '' })
  }

  function openEvent(eventId: string) {
    set({ event: getEvent(eventId), eventResultText: null, phase: 'event', message: '' })
  }

  return {
    phase: 'menu',
    lives: STARTING_LIVES,
    souls: 0,
    handsPlayed: 0,
    map: null,
    mapColumn: 0,
    ownedCharms: [],
    ownedRituals: [],
    pendingChipBonus: 0,

    creature: null,
    round: 0,
    handsThisEncounter: 0,

    hand: null,
    isDealerThinking: false,
    lastResult: null,
    effectMessages: [],

    revealDealerHole: false,
    creatureSeesPlayer: null,
    playerSeesDealer: null,
    peekedFlop: [],
    ritualsUsedThisHand: [],
    playerAggressedThisHand: false,

    rewardCharms: [],
    shopItems: [],
    event: null,
    eventResultText: null,

    message: '',
    fx: null,

    maxLives: () => maxLivesWith(charmLivesDelta()),

    startRun: () => {
      set({
        phase: 'map',
        lives: STARTING_LIVES,
        souls: 3, // a small stipend so the first ritual can be tasted early
        handsPlayed: 0,
        map: generateMap(),
        mapColumn: 0,
        ownedCharms: [],
        ownedRituals: ['glimpse'], // start with one ritual so the layer is felt early
        pendingChipBonus: 0,
        creature: null,
        round: 0,
        handsThisEncounter: 0,
        hand: null,
        lastResult: null,
        effectMessages: [],
        rewardCharms: [],
        shopItems: [],
        event: null,
        eventResultText: null,
        message: 'Choose your descent.',
      })
    },

    chooseNode: (index) => {
      const state = get()
      if (!state.map) return
      const col = state.map.columns[state.mapColumn]
      const node: MapNode | undefined = col?.[index]
      if (!node) return

      // The map depth drives difficulty for everything that follows.
      set({ round: state.mapColumn })

      switch (node.type) {
        case 'dealer':
        case 'elite':
        case 'boss':
          startEncounterWith(node.creatureId!)
          break
        case 'shop':
          openShop()
          break
        case 'event':
          openEvent(node.eventId!)
          break
        case 'rest':
          set({ phase: 'rest', message: '' })
          break
      }
    },

    beginEncounter: () => {
      set({ phase: 'playing' })
      dealHand(true)
    },

    startNextHand: () => dealHand(false),

    playerAction: (action, raiseTo) => {
      const cur = get().hand
      if (!cur || cur.toAct !== 'player' || cur.street === 'complete') return
      if (action === 'allin') triggerFx('allin')
      if (action === 'raise' || action === 'allin') {
        set({ playerAggressedThisHand: true })
      }
      const next = engineApplyAction(cur, 'player', action, raiseTo)
      applyHandState(next)
    },

    useRitual: (id, targetIndex) => {
      const state = get()
      const ritual = getRitual(id)
      const hand = state.hand
      if (!ritual || !hand) return
      if (!state.ownedRituals.includes(id)) return
      if (state.souls < ritual.cost) return
      if (state.ritualsUsedThisHand.includes(id)) return
      if (!ritualUsable(ritual.kind, hand)) return

      const spendSouls = () =>
        set({ souls: state.souls - ritual.cost, ritualsUsedThisHand: [...state.ritualsUsedThisHand, id] })

      switch (ritual.kind) {
        case 'glimpse': {
          spendSouls()
          triggerFx('ritual')
          set({ revealDealerHole: true, message: 'The creature\'s cards turn face-up to you alone.' })
          break
        }
        case 'sear': {
          const idx = targetIndex ?? 0
          spendSouls()
          triggerFx('ritual')
          set({ message: 'You sear a card and draw anew.' })
          applyHandState(applySear(hand, idx))
          break
        }
        case 'cinder': {
          spendSouls()
          triggerFx('ritual')
          set({ message: 'The flop burns. Three new cards fall.' })
          applyHandState(applyCinder(hand))
          break
        }
        case 'ironWill': {
          spendSouls()
          triggerFx('ritual')
          set({ message: 'Iron Will — you refuse the creature\'s bet.' })
          applyHandState(applyIronWill(hand))
          break
        }
        case 'bloodAnte': {
          spendSouls()
          triggerFx('ritual')
          set({ message: 'Blood Ante — souls bleed into chips.' })
          applyHandState(applyBloodAnte(hand))
          break
        }
        case 'hex': {
          spendSouls()
          triggerFx('ritual')
          const res = applyHex(hand)
          set({
            message: res.worked
              ? 'The creature flinches at the name — and folds.'
              : 'The creature does not fear that name. The souls burn for naught.',
          })
          applyHandState(res.hand)
          break
        }
      }
    },

    continueRun: () => {
      const state = get()
      const hand = state.hand
      const creature = state.creature
      if (!hand || !creature) return

      // Dealer busted → encounter won. Souls + reward, then onward (or victory).
      if (hand.dealer.chips <= 0) {
        const agg = aggregateCharms(state.ownedCharms)
        const soulsGained = creature.bounty + (agg.soulsPerRound ?? 0)
        set({ souls: state.souls + soulsGained })

        if (creature.tier === 'boss') {
          set({ phase: 'victory', message: 'The Clockwork Maw shatters. You walk out of the dark.' })
          triggerFx('victory')
          return
        }

        triggerFx('roundWin')
        const offers = offerCharms(state.ownedCharms, REWARD_CHARM_CHOICES)
        if (offers.length === 0) {
          // Nothing left to offer — skip straight on.
          set({ message: `${creature.name} is broken. +${soulsGained} souls.` })
          advanceMap()
          return
        }
        set({
          phase: 'reward',
          rewardCharms: offers,
          message: `${creature.name} is broken. +${soulsGained} souls. Take a spoil.`,
        })
        return
      }

      // Player busted → lose a life (retry the same creature), or die.
      if (hand.player.chips <= 0) {
        const lives = state.lives - 1
        if (lives <= 0) {
          set({ lives: 0, phase: 'gameover' })
          triggerFx('death')
          return
        }
        set({
          lives,
          message: `A life torn away. ${lives} left. The ${creature.name} resets the table.`,
          handsThisEncounter: 0,
        })
        triggerFx('lose')
        dealHand(true) // fresh duel vs the same creature
        return
      }

      // Normal continuation — next hand of the same encounter.
      get().startNextHand()
    },

    takeReward: (charmId) => {
      if (charmId) grantCharm(charmId)
      set({ rewardCharms: [] })
      advanceMap()
    },

    buyShopItem: (index) => {
      const state = get()
      const item = state.shopItems[index]
      if (!item || item.sold || state.souls < item.cost) return

      if (item.kind === 'charm' && item.id) grantCharm(item.id)
      else if (item.kind === 'ritual' && item.id) grantRitual(item.id)
      else if (item.kind === 'mend') {
        set({ lives: Math.min(state.maxLives(), state.lives + 1) })
      }

      const items = state.shopItems.map((it, i) => (i === index ? { ...it, sold: true } : it))
      set({ souls: get().souls - item.cost, shopItems: items })
    },

    leaveShop: () => advanceMap(),

    resolveEvent: (optionIndex) => {
      const state = get()
      const ev = state.event
      if (!ev) return
      const opt: EventOption | undefined = ev.options[optionIndex]
      if (!opt) return
      if (opt.costSouls && state.souls < opt.costSouls) return

      // Pay the up-front cost.
      let souls = state.souls - (opt.costSouls ?? 0)
      let pendingChip = state.pendingChipBonus - (opt.costChips ?? 0)

      const win = opt.chance === undefined ? true : Math.random() < opt.chance
      const outcome = win ? opt.win : opt.lose ?? opt.win

      let lives = state.lives
      if (outcome.souls) souls += outcome.souls
      if (outcome.chips) pendingChip += outcome.chips
      if (outcome.lives) lives = Math.min(state.maxLives(), lives + outcome.lives)
      set({ souls: Math.max(0, souls), pendingChipBonus: pendingChip, lives })
      if (outcome.grantCharm) {
        const offer = offerCharms(get().ownedCharms, 1)
        if (offer[0]) grantCharm(offer[0])
      }
      if (outcome.grantRitual) {
        const offer = offerRituals(get().ownedRituals, 1)
        if (offer[0]) grantRitual(offer[0])
      }
      set({ eventResultText: outcome.text })
    },

    dismissEvent: () => {
      set({ event: null, eventResultText: null })
      advanceMap()
    },

    resolveRest: (choice) => {
      const state = get()
      if (choice === 'mend') {
        set({ lives: Math.min(state.maxLives(), state.lives + REST_MEND_LIVES) })
      } else {
        set({ souls: state.souls + REST_SCAVENGE_SOULS })
      }
      advanceMap()
    },

    backToMenu: () => {
      set({
        phase: 'menu',
        hand: null,
        lastResult: null,
        creature: null,
        map: null,
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
