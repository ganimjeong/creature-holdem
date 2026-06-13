// Shared 3D layout + visual theme. Every scene component imports from here so
// card positions, the table, the dealer, and the camera all agree. Distances are
// in world units; the table surface sits at y = 0.

import * as THREE from 'three'

export const CARD = {
  width: 0.5,
  height: 0.7,
  thickness: 0.018,
}

export const TABLE = {
  radius: 3.0,
  rimRadius: 3.25,
  height: 0.28, // cylinder height; top surface at y = 0
  surfaceY: 0.0,
}

/** Camera framing: the player's seat, looking across the felt at the creature. */
export const CAMERA = {
  position: new THREE.Vector3(0, 2.45, 3.9),
  target: new THREE.Vector3(0, 0.15, -0.7),
  fov: 42,
}

const CARD_Y = TABLE.surfaceY + 0.012
const CARD_GAP = 0.62

/** Player's two hole cards, near the bottom edge in front of the camera. */
export function playerHolePos(i: number): [number, number, number] {
  return [(i - 0.5) * CARD_GAP, CARD_Y, 1.75]
}

/** Dealer's two hole cards, at the far edge by the creature. */
export function dealerHolePos(i: number): [number, number, number] {
  return [(i - 0.5) * CARD_GAP, CARD_Y, -1.75]
}

/** Five community cards across the middle of the table. */
export function communityPos(i: number): [number, number, number] {
  return [(i - 2) * CARD_GAP, CARD_Y, 0]
}

/** Where the creature dealer looms — behind the far table edge and raised so it
 *  towers ABOVE the felt and cards rather than standing in them. */
export const DEALER_ANCHOR = new THREE.Vector3(0, 0.4, -3.5)

/** Chip-stack anchors for player and dealer bets. */
export const CHIP_ANCHOR = {
  player: new THREE.Vector3(0, TABLE.surfaceY, 1.05),
  dealer: new THREE.Vector3(0, TABLE.surfaceY, -1.05),
  pot: new THREE.Vector3(0, TABLE.surfaceY, 0.55),
}

/** Steampunk-horror palette. Dark, warm brass + ember, sickly creature glows. */
export const THEME = {
  background: '#050304',
  fog: '#0a0705',
  felt: '#10231c', // deep desaturated green
  feltEdge: '#08140f',
  brass: '#b9893f',
  brassDark: '#5a3f1c',
  ember: '#ff7a1a',
  emberDim: '#7a2e06',
  candle: '#ffb04a',
  creatureGlow: '#7cff5a', // sickly green eye glow
  bloodGlow: '#ff2b2b',
  cardFace: '#efe6d2',
  cardBack: '#3a1d12',
  cardBackInk: '#caa25a',
  rimLight: '#ff8c3a',
  cold: '#2b4a6b',
} as const

export type ThemeColor = keyof typeof THEME
