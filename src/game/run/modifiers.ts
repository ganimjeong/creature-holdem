// The effect layer. The poker engine stays pure and rules-correct; everything the
// roguelike bolts on (charm boons, creature abilities, ritual powers) is computed
// here and applied by the store. Keeping it in one module means the whole "what
// bends the rules, and how" surface is auditable in a single place — and that the
// no-invincibility promise (every edge has a cost or counter) is enforced here.

import { Card } from '../engine/types'
import { HandState, HandResult, Seat, forceFold } from '../engine/holdem'
import {
  AIProfile,
  DealerContext,
  CreatureSight,
  dealerStrength,
} from '../engine/dealerAI'
import { Creature } from '../content/creatures'
import { CharmEffect, getCharm } from '../content/charms'
import { PLAYER_START_CHIPS, Blinds } from './roguelike'

// ---------------------------------------------------------------------------
// Charm aggregation
// ---------------------------------------------------------------------------

const HAND_ORDER = [
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
  'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush',
]

export function handRank(name?: string): number {
  return name ? HAND_ORDER.indexOf(name) : -1
}

/** Sum/merge the effects of every owned charm into one resolved object. */
export function aggregateCharms(owned: string[]): CharmEffect {
  const acc: CharmEffect = {}
  const addNum = (k: keyof CharmEffect, v?: number) => {
    if (v === undefined) return
    ;(acc[k] as number) = ((acc[k] as number) ?? 0) + v
  }
  for (const id of owned) {
    const e = getCharm(id)?.effect
    if (!e) continue
    addNum('startChips', e.startChips)
    addNum('dealerStartChips', e.dealerStartChips)
    addNum('maxLivesDelta', e.maxLivesDelta)
    addNum('soulsPerRound', e.soulsPerRound)
    addNum('showdownWinBonus', e.showdownWinBonus)
    addNum('showdownLossPenalty', e.showdownLossPenalty)
    addNum('drainOnWin', e.drainOnWin)
    addNum('drainSelfOnLoss', e.drainSelfOnLoss)
    addNum('earlyFlopPeek', e.earlyFlopPeek)
    if (e.veilChance) acc.veilChance = Math.max(acc.veilChance ?? 0, e.veilChance)
    if (e.tellAura) acc.tellAura = true
    if (e.winBonusMinHand && acc.winBonusMinHand === undefined) {
      acc.winBonusMinHand = e.winBonusMinHand
    }
  }
  return acc
}

// ---------------------------------------------------------------------------
// Encounter seeding — fresh stacks + blinds for a creature duel
// ---------------------------------------------------------------------------

/** Dealer stack scales gently with depth so duels escalate without becoming
 *  unwinnable grinds (each encounter reseeds both stacks fresh). */
function baseDealerChips(round: number): number {
  return Math.round(PLAYER_START_CHIPS * (1 + round * 0.18))
}

/** Blinds curve, kept shallow relative to stacks so deep duels stay playable
 *  (roughly 15–18 big blinds even at the boss) rather than degenerate shoves. */
export function baseEncounterBlinds(round: number): Blinds {
  const bb = 20 + round * 15
  return { sb: Math.round(bb / 2), bb }
}

/** Starting stacks for a new creature encounter (each duel is self-contained). */
export function encounterSeed(
  round: number,
  agg: CharmEffect,
  creature: Creature,
  pendingChipBonus = 0,
): { player: number; dealer: number } {
  const player = Math.max(100, PLAYER_START_CHIPS + (agg.startChips ?? 0) + pendingChipBonus)
  const lead = creature.ability.kind === 'chipLead' ? creature.ability.mult : 1
  const dealer = Math.round(baseDealerChips(round) * lead) + (agg.dealerStartChips ?? 0)
  return { player, dealer }
}

/** Blinds for the current hand, including the Furnace's within-encounter ramp. */
export function encounterBlinds(
  round: number,
  creature: Creature,
  handsThisEncounter: number,
): Blinds {
  if (creature.ability.kind === 'blindRamp') {
    const steps = Math.floor(handsThisEncounter / creature.ability.everyHands)
    return baseEncounterBlinds(round + steps)
  }
  return baseEncounterBlinds(round)
}

// ---------------------------------------------------------------------------
// Dealer AI context from a creature
// ---------------------------------------------------------------------------

export function sightFor(creature: Creature): CreatureSight {
  if (creature.ability.kind === 'peek') return 'peek'
  if (creature.ability.kind === 'riverSight') return 'river'
  return 'none'
}

export function dealerContextFor(
  creature: Creature,
  playerWasAggressive: boolean,
): DealerContext {
  return {
    profile: creature.profile as AIProfile,
    sight: sightFor(creature),
    playerWasAggressive,
  }
}

// ---------------------------------------------------------------------------
// Hand-resolution effects (rake / bonuses / drains / soul leech)
// ---------------------------------------------------------------------------

export interface HandEffects {
  playerChipDelta: number
  dealerChipDelta: number
  soulDelta: number
  messages: string[]
}

/**
 * Compute the post-hand adjustments from charms + the creature's ability. The
 * engine has already pushed the base pot to the winner; these are the deltas the
 * store layers on top (and then clamps to non-negative stacks).
 */
export function computeHandEffects(
  hand: HandState,
  result: HandResult,
  agg: CharmEffect,
  creature: Creature,
): HandEffects {
  const out: HandEffects = { playerChipDelta: 0, dealerChipDelta: 0, soulDelta: 0, messages: [] }
  const pot = result.potWon
  const playerWon = result.winner === 'player'
  const dealerWon = result.winner === 'dealer'

  // Creature rake — taxes every pot, win or lose. Counter: keep pots small.
  if (creature.ability.kind === 'rake' && pot > 0) {
    const voided = Math.floor(pot * creature.ability.pct)
    if (voided > 0) {
      if (result.winner === 'split') {
        out.playerChipDelta -= Math.floor(voided / 2)
        out.dealerChipDelta -= voided - Math.floor(voided / 2)
      } else if (playerWon) {
        out.playerChipDelta -= voided
      } else {
        out.dealerChipDelta -= voided
      }
      out.messages.push(`${creature.name} swallows ${voided} from the pot.`)
    }
  }

  if (result.reason === 'showdown') {
    // Bone Ante — premium showdown wins pay extra; losing showdowns cost extra.
    if (playerWon && agg.showdownWinBonus && handRank(result.playerHandName) >= handRank(agg.winBonusMinHand)) {
      const bonus = Math.floor(pot * agg.showdownWinBonus)
      if (bonus > 0) {
        out.playerChipDelta += bonus
        out.messages.push(`Bone Ante pays out ${bonus} more.`)
      }
    }
    if (dealerWon && agg.showdownLossPenalty) {
      const pen = Math.floor(hand.player.chips * agg.showdownLossPenalty)
      if (pen > 0) {
        out.playerChipDelta -= pen
        out.messages.push(`Bone Ante's variance bites: -${pen}.`)
      }
    }

    // Vein Tap — drains the loser of the showdown (cuts both ways).
    if (agg.drainOnWin && playerWon) {
      const drain = Math.floor(hand.dealer.chips * agg.drainOnWin)
      if (drain > 0) {
        out.dealerChipDelta -= drain
        out.playerChipDelta += drain
        out.messages.push(`Vein Tap drains ${drain} from the creature.`)
      }
    }
    if (agg.drainSelfOnLoss && dealerWon) {
      const drain = Math.floor(hand.player.chips * agg.drainSelfOnLoss)
      if (drain > 0) {
        out.playerChipDelta -= drain
        out.dealerChipDelta += drain
        out.messages.push(`Vein Tap turns on you: -${drain}.`)
      }
    }

    // Creature soul leech — losing a showdown to it costs a soul.
    if (creature.ability.kind === 'soulLeech' && dealerWon) {
      out.soulDelta -= creature.ability.souls
      out.messages.push(`${creature.name} sips ${creature.ability.souls} soul${creature.ability.souls > 1 ? 's' : ''}.`)
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// Per-hand information reveals (peek / veil / cracked lens)
// ---------------------------------------------------------------------------

export interface RevealPlan {
  /** Player hole index the creature has read (peek, or a veil that thinned wrong). */
  creatureSeesPlayer: number | null
  /** Dealer hole index revealed to the player (a veil that worked). */
  playerSeesDealer: number | null
  /** Upcoming flop cards revealed early to the player (Cracked Lens). */
  earlyFlop: Card[]
}

export function planReveals(
  hand: HandState,
  agg: CharmEffect,
  creature: Creature,
  rng: () => number = Math.random,
): RevealPlan {
  const plan: RevealPlan = { creatureSeesPlayer: null, playerSeesDealer: null, earlyFlop: [] }

  // The Watcher always reads one of your cards.
  if (creature.ability.kind === 'peek') {
    plan.creatureSeesPlayer = rng() < 0.5 ? 0 : 1
  }

  // Widow's Veil — a coin flip each hand: you glimpse the creature, or it glimpses you.
  if (agg.veilChance && agg.veilChance > 0) {
    if (rng() < agg.veilChance) {
      plan.playerSeesDealer = rng() < 0.5 ? 0 : 1
    } else if (plan.creatureSeesPlayer === null) {
      plan.creatureSeesPlayer = rng() < 0.5 ? 0 : 1
    }
  }

  // Cracked Lens — peek the top of the deck (the flop is dealt from the end).
  if (agg.earlyFlopPeek && agg.earlyFlopPeek > 0) {
    const n = Math.min(agg.earlyFlopPeek, 3)
    const top = hand.deck.slice(-n).reverse() // deal order
    plan.earlyFlop = top
  }

  return plan
}

// ---------------------------------------------------------------------------
// Ritual transforms — pure HandState → HandState (or info for the store)
// ---------------------------------------------------------------------------

export const BLOOD_ANTE_CHIPS = 250
const HEX_THRESHOLD = 0.4

function cloneHand(prev: HandState): HandState {
  return {
    ...prev,
    player: { ...prev.player, hole: prev.player.hole.slice() },
    dealer: { ...prev.dealer, hole: prev.dealer.hole.slice() },
    community: prev.community.slice(),
    deck: prev.deck.slice(),
    log: prev.log.slice(),
  }
}

/** Burn one of your hole cards and draw a fresh one (from the deck's far end so
 *  the planned community board is undisturbed). */
export function applySear(hand: HandState, holeIndex: number, _rng?: () => number): HandState {
  if (hand.deck.length === 0) return hand
  const next = cloneHand(hand)
  const fresh = next.deck.shift()!
  next.player.hole[holeIndex] = fresh
  next.log.push('You sear a card to ash and draw anew.')
  return next
}

/** Re-deal the flop with three fresh cards. Only meaningful on the flop. */
export function applyCinder(hand: HandState): HandState {
  if (hand.street !== 'flop' || hand.deck.length < 3) return hand
  const next = cloneHand(hand)
  const fresh = [next.deck.shift()!, next.deck.shift()!, next.deck.shift()!]
  next.community = fresh
  next.revealedCommunity = 3
  next.log.push('You sweep the flop into the furnace and deal three anew.')
  return next
}

/** Refuse the creature's bet this street: its excess chips slide back and it is
 *  marked as having acted, so a single check from you runs the hand on. */
export function applyIronWill(hand: HandState): HandState {
  const d = hand.dealer
  const p = hand.player
  const excess = d.committed - p.committed
  if (excess <= 0 || (d.allIn && excess > 0)) return hand // nothing to refuse / can't stop a shove
  const next = cloneHand(hand)
  next.dealer.chips += excess
  next.dealer.committed -= excess
  next.dealer.totalCommitted -= excess
  next.pot -= excess
  next.dealer.allIn = next.dealer.chips === 0 ? next.dealer.allIn : false
  next.currentBet = next.player.committed
  next.dealer.actedThisStreet = true
  next.toAct = 'player'
  next.log.push('Iron Will — you refuse the creature\'s bet.')
  return next
}

/** Spend souls for chips (the store charges the souls; this adds the chips). */
export function applyBloodAnte(hand: HandState, amount = BLOOD_ANTE_CHIPS): HandState {
  const next = cloneHand(hand)
  next.player.chips += amount
  next.log.push(`Blood Ante — ${amount} chips bleed onto your stack.`)
  return next
}

export interface HexResult {
  hand: HandState
  worked: boolean
}

/** Force a weak creature to fold; a strong one shrugs it off (souls wasted). */
export function applyHex(hand: HandState): HexResult {
  const strength = dealerStrength(hand)
  if (strength < HEX_THRESHOLD) {
    return { hand: forceFold(hand, 'dealer'), worked: true }
  }
  return { hand, worked: false }
}

// ---------------------------------------------------------------------------
// Ritual legality — drives whether each ritual button is enabled
// ---------------------------------------------------------------------------

import { RitualKind } from '../content/rituals'

export function ritualUsable(kind: RitualKind, hand: HandState | null): boolean {
  if (!hand) return false
  const active = hand.toAct === 'player' && hand.street !== 'complete' && hand.street !== 'showdown'
  switch (kind) {
    case 'glimpse':
      return active && hand.dealerHoleHidden
    case 'sear':
      return active && hand.street !== 'river'
    case 'cinder':
      return active && hand.street === 'flop'
    case 'ironWill': {
      const facing = hand.currentBet > hand.player.committed
      return active && facing && !hand.dealer.allIn
    }
    case 'bloodAnte':
      return active
    case 'hex':
      return active && !hand.dealer.allIn
    default:
      return false
  }
}
