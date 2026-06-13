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

interface PlayingCardProps {
  card: Card
  position: [number, number, number]
  faceUp: boolean
  index: number
}

function PlayingCard({ card, position, faceUp, index }: PlayingCardProps) {
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

    // A faint settle wobble that fades as the card lands.
    g.rotation.x = (1 - ease) * 0.25 + Math.sin(performance.now() * 0.0007 + phase) * 0.004
  })

  // Tiny epsilons keep the printed text off the box faces (no z-fighting).
  const faceY = CARD.thickness / 2 + 0.001
  const backY = -CARD.thickness / 2 - 0.001

  return (
    <group ref={group} position={start}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[CARD.width, CARD.thickness, CARD.height]} />
        <meshStandardMaterial
          color={THEME.cardFace}
          roughness={0.62}
          metalness={0.05}
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
        position={[-CARD.width / 2 + 0.09, faceY, -CARD.height / 2 + 0.12]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.16}
        color={suitColor}
        anchorX="center"
        anchorY="middle"
      >
        {card.rank}
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
  if (!hand) return null

  return (
    <group>
      {hand.player.hole.map((c, i) => (
        <PlayingCard
          key={c.id}
          card={c}
          position={playerHolePos(i)}
          faceUp
          index={i}
        />
      ))}

      {hand.community.slice(0, hand.revealedCommunity).map((c, i) => (
        <PlayingCard
          key={c.id}
          card={c}
          position={communityPos(i)}
          faceUp
          index={i}
        />
      ))}

      {hand.dealer.hole.map((c, i) => (
        <PlayingCard
          key={c.id}
          card={c}
          position={dealerHolePos(i)}
          faceUp={!hand.dealerHoleHidden}
          index={i}
        />
      ))}
    </group>
  )
}
