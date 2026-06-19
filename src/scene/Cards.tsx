// The cards on the felt: player hole, the community spread, and the dealer's
// (often hidden) hole cards. Each card deals in from the creature's anchor,
// flips between an inked brass back and a parchment face, and breathes with a
// faint float. The whole visual leans on emissive ink so Bloom catches it.

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'

import { useGame } from '../game/store/gameStore'
import type { Card } from '../game/engine/types'
import { SUIT_SYMBOL, SUIT_IS_RED } from '../game/engine/types'
import {
  CARD,
  THEME,
  DEALER_ANCHOR,
  playerHolePos,
  dealerHolePos,
  communityPos,
} from './layout'

const FACE_RED = '#a01818'
const FACE_INK = '#1a1410'
const DEAL_DURATION = 0.4
const WIN_GLOW = '#ffd27a' // warm gold spotlight on the winning five

/** Display label for a rank — "T" reads as "10" to players. */
const rankLabel = (r: Card['rank']) => (r === 'T' ? '10' : r)

// Procedural paper stock: a faint fibre/speckle albedo + matching bump so the
// card reads as printed card stock rather than glossy plastic. Built once and
// shared by every card.
let _paper: { map: THREE.Texture; bump: THREE.Texture } | null = null
function getPaper(): { map: THREE.Texture; bump: THREE.Texture } {
  if (_paper) return _paper

  const N = 256
  const albedo = document.createElement('canvas')
  albedo.width = albedo.height = N
  const a = albedo.getContext('2d')!
  a.fillStyle = THEME.cardFace
  a.fillRect(0, 0, N, N)
  // Fine speckle.
  for (let i = 0; i < 11000; i++) {
    const x = Math.random() * N
    const y = Math.random() * N
    const dark = Math.random() < 0.5
    a.fillStyle = dark ? 'rgba(120,104,78,0.05)' : 'rgba(255,250,238,0.06)'
    a.fillRect(x, y, 1, 1)
  }
  // Faint long fibres.
  for (let i = 0; i < 90; i++) {
    a.strokeStyle = `rgba(150,132,98,${0.04 + Math.random() * 0.05})`
    a.lineWidth = 1
    const x = Math.random() * N
    const y = Math.random() * N
    const len = 8 + Math.random() * 26
    const ang = Math.random() * Math.PI
    a.beginPath()
    a.moveTo(x, y)
    a.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len)
    a.stroke()
  }
  // Slightly grubby deckle edge.
  const grad = a.createRadialGradient(N / 2, N / 2, N * 0.32, N / 2, N / 2, N * 0.6)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(60,48,30,0.16)')
  a.fillStyle = grad
  a.fillRect(0, 0, N, N)

  // Bump: mid-grey base with the same micro speckle for tactile relief.
  const bump = document.createElement('canvas')
  bump.width = bump.height = N
  const b = bump.getContext('2d')!
  b.fillStyle = '#808080'
  b.fillRect(0, 0, N, N)
  for (let i = 0; i < 14000; i++) {
    const x = Math.random() * N
    const y = Math.random() * N
    const v = Math.random() < 0.5 ? 90 : 170
    b.fillStyle = `rgb(${v},${v},${v})`
    b.fillRect(x, y, 1, 1)
  }

  const map = new THREE.CanvasTexture(albedo)
  map.anisotropy = 4
  const bumpTex = new THREE.CanvasTexture(bump)
  _paper = { map, bump: bumpTex }
  return _paper
}

interface PlayingCardProps {
  card: Card
  position: [number, number, number]
  faceUp: boolean
  index: number
  /** Resting tilt around X (radians) so a card can stand up toward the camera. */
  tilt?: number
  /** Uniform scale (player hole cards are enlarged for readability). */
  scale?: number
  /** Part of the winning five at showdown — gets a glowing gold spotlight. */
  highlight?: boolean
}

function PlayingCard({
  card,
  position,
  faceUp,
  index,
  tilt = 0,
  scale = 1,
  highlight = false,
}: PlayingCardProps) {
  const faceMat = useRef<THREE.MeshStandardMaterial>(null!)
  const halo = useRef<THREE.Mesh>(null!)
  const winning = highlight && faceUp
  const paper = useMemo(getPaper, [])
  const group = useRef<THREE.Group>(null!)
  // Deal-in progress: 0 -> 1 over DEAL_DURATION. Lives in a ref so re-renders
  // (e.g. a flip) don't restart the animation; only a new card.id (new key)
  // remounts and resets it.
  const dealT = useRef(0)
  // Eased flip angle around the long (z) axis; PI = face hidden (showing back).
  const flip = useRef(faceUp ? 0 : Math.PI)
  // Per-card phase so the idle float isn't perfectly synced across the table.
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])

  const target = useMemo(
    () => new THREE.Vector3(position[0], position[1], position[2]),
    [position[0], position[1], position[2]],
  )
  // Where the card flies in from: lifted and pulled toward the creature.
  const start = useMemo(() => {
    const s = target.clone()
    s.x += (DEALER_ANCHOR.x - target.x) * 0.35
    s.z += (DEALER_ANCHOR.z - target.z) * 0.4
    s.y += 0.9
    return s
  }, [target])

  const suitColor = SUIT_IS_RED[card.suit] ? FACE_RED : FACE_INK
  const symbol = SUIT_SYMBOL[card.suit]

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return

    // Deal-in: ease the world position from the creature toward the slot, with
    // a small staggered delay so cards land one after another.
    const stagger = index * 0.08
    dealT.current = Math.min(1, dealT.current + delta / DEAL_DURATION)
    const t = THREE.MathUtils.clamp(dealT.current - stagger, 0, 1)
    const ease = 1 - Math.pow(1 - t, 3)

    const floatY = Math.sin(performance.now() * 0.0009 + phase) * 0.006
    const arc = Math.sin(ease * Math.PI) * 0.12 // slight hop mid-flight

    g.position.x = THREE.MathUtils.lerp(start.x, target.x, ease)
    g.position.y = THREE.MathUtils.lerp(start.y, target.y, ease) + arc + floatY * ease
    g.position.z = THREE.MathUtils.lerp(start.z, target.z, ease)

    // Eased flip toward the face/back target.
    const flipTarget = faceUp ? 0 : Math.PI
    flip.current = THREE.MathUtils.damp(flip.current, flipTarget, 9, delta)
    g.rotation.z = flip.current

    // Resting tilt (e.g. player cards standing up toward the camera) plus a
    // faint settle wobble that fades as the card lands.
    g.rotation.x =
      tilt + (1 - ease) * 0.25 + Math.sin(performance.now() * 0.0007 + phase) * 0.004

    // Winning-five spotlight: pulse the face glow + a hovering gold halo, and
    // lift the card a touch so it pops out of the spread.
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.005 + phase)
    if (faceMat.current) {
      faceMat.current.emissiveIntensity = winning
        ? THREE.MathUtils.damp(faceMat.current.emissiveIntensity, 0.45 + pulse * 0.45, 8, delta)
        : THREE.MathUtils.damp(faceMat.current.emissiveIntensity, 0, 8, delta)
    }
    if (halo.current) {
      const m = halo.current.material as THREE.MeshBasicMaterial
      m.opacity = THREE.MathUtils.damp(m.opacity, winning ? 0.25 + pulse * 0.35 : 0, 8, delta)
      halo.current.visible = m.opacity > 0.01
    }
    if (winning) g.position.y += 0.06
  })

  // Tiny epsilons keep the printed text off the box faces (no z-fighting).
  const faceY = CARD.thickness / 2 + 0.001
  const faceYHalo = CARD.thickness / 2 + 0.01
  const backY = -CARD.thickness / 2 - 0.001
  const label = rankLabel(card.rank)

  return (
    <group ref={group} position={start} scale={scale}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[CARD.width, CARD.thickness, CARD.height]} />
        <meshStandardMaterial
          ref={faceMat}
          map={paper.map}
          bumpMap={paper.bump}
          bumpScale={0.004}
          color={'#ffffff'}
          roughness={0.95}
          metalness={0}
          emissive={WIN_GLOW}
          emissiveIntensity={0}
        />
      </mesh>

      {/* Gold aura that hovers over the winning five at showdown. */}
      <mesh ref={halo} position={[0, faceYHalo, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <planeGeometry args={[CARD.width * 1.22, CARD.height * 1.18]} />
        <meshBasicMaterial
          color={WIN_GLOW}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Back: dark leather with an emissive brass emblem. */}
      <mesh position={[0, -CARD.thickness / 2 - 0.0005, 0]} rotation={[Math.PI, 0, 0]}>
        <planeGeometry args={[CARD.width, CARD.height]} />
        <meshStandardMaterial
          color={THEME.cardBack}
          roughness={0.78}
          metalness={0.1}
        />
      </mesh>
      <Text
        position={[0, backY, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        fontSize={0.26}
        color={THEME.cardBackInk}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0}
      >
        {'♦'}
        <meshStandardMaterial
          attach="material"
          color={THEME.cardBackInk}
          emissive={THEME.cardBackInk}
          emissiveIntensity={0.5}
          toneMapped={false}
        />
      </Text>

      {/* Face: rank top-left, large center suit. Only readable when faceUp. */}
      <Text
        position={[-CARD.width / 2 + 0.1, faceY, -CARD.height / 2 + 0.12]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={label.length > 1 ? 0.13 : 0.16}
        color={suitColor}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
      <Text
        position={[-CARD.width / 2 + 0.09, faceY, -CARD.height / 2 + 0.27]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.11}
        color={suitColor}
        anchorX="center"
        anchorY="middle"
      >
        {symbol}
      </Text>
      <Text
        position={[0, faceY, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.34}
        color={suitColor}
        anchorX="center"
        anchorY="middle"
      >
        {symbol}
      </Text>
    </group>
  )
}

export function Cards() {
  const hand = useGame((s) => s.hand)
  const lastResult = useGame((s) => s.lastResult)
  const revealDealerHole = useGame((s) => s.revealDealerHole)
  if (!hand) return null

  // The five cards forming the winning hand (set only at showdown). Used to
  // spotlight them once the hand is complete.
  const winners = new Set(
    hand.street === 'complete' ? lastResult?.winningCards ?? [] : [],
  )
  const code = (c: Card) => `${c.rank}${c.suit}`

  return (
    <group>
      {hand.player.hole.map((c, i) => {
        // Lift the player's cards off the felt and tilt them up toward the
        // camera so they're actually readable from the seated view.
        const p = playerHolePos(i)
        return (
          <PlayingCard
            key={c.id}
            card={c}
            position={[p[0] * 1.15, p[1] + 0.22, p[2] + 0.05]}
            faceUp
            index={i}
            tilt={0.72}
            scale={1.2}
            highlight={winners.has(code(c))}
          />
        )
      })}

      {hand.community.slice(0, hand.revealedCommunity).map((c, i) => (
        <PlayingCard
          key={c.id}
          card={c}
          position={communityPos(i)}
          faceUp
          index={i}
          highlight={winners.has(code(c))}
        />
      ))}

      {hand.dealer.hole.map((c, i) => (
        <PlayingCard
          key={c.id}
          card={c}
          position={dealerHolePos(i)}
          faceUp={!hand.dealerHoleHidden || revealDealerHole}
          index={i}
          highlight={winners.has(code(c))}
        />
      ))}
    </group>
  )
}
