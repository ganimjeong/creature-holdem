// Casino-style chip stacks for the pot and each seat's current bet. Chips carry
// a procedural clay-chip texture (edge spots, inlay ring, denomination) and,
// when a bet grows, the new chips are *tossed* in — arcing and tumbling from the
// bettor's side onto the stack rather than just popping into place.

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGame } from '../game/store/gameStore'
import { CHIP_ANCHOR, TABLE, THEME } from './layout'

const CHIP_RADIUS = 0.15
const CHIP_HEIGHT = 0.032
const CHIP_DENOM = 25 // chips ≈ amount / denom
const MAX_CHIPS = 24

/** Deterministic pseudo-random in [-1, 1] from an integer seed. */
function jitter(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

/** Build the clay-chip face + edge textures for a given colour scheme (cached). */
function makeChipTextures(base: string, accent: string, denom: string) {
  // --- top/bottom face: base disc, edge spots, inlay ring, denomination ---
  const top = document.createElement('canvas')
  top.width = top.height = 256
  const ctx = top.getContext('2d')!
  const C = 128
  const R = 124

  ctx.clearRect(0, 0, 256, 256)
  ctx.fillStyle = base
  ctx.beginPath()
  ctx.arc(C, C, R, 0, Math.PI * 2)
  ctx.fill()

  // Edge spots (the classic alternating rim blocks).
  ctx.fillStyle = accent
  const spots = 8
  for (let i = 0; i < spots; i++) {
    ctx.save()
    ctx.translate(C, C)
    ctx.rotate((i / spots) * Math.PI * 2)
    ctx.fillRect(R - 40, -17, 34, 34)
    ctx.restore()
  }

  // Inlay ring + center disc.
  ctx.strokeStyle = accent
  ctx.lineWidth = 9
  ctx.beginPath()
  ctx.arc(C, C, R - 50, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = base
  ctx.beginPath()
  ctx.arc(C, C, R - 62, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = accent
  ctx.beginPath()
  ctx.arc(C, C, R - 62, 0, Math.PI * 2)
  ctx.stroke()

  // Denomination.
  ctx.fillStyle = accent
  ctx.font = "bold 66px Georgia, 'Times New Roman', serif"
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(denom, C, C + 4)

  const topTex = new THREE.CanvasTexture(top)
  topTex.anisotropy = 4

  // --- edge: base band with repeating accent dashes ---
  const edge = document.createElement('canvas')
  edge.width = 256
  edge.height = 48
  const ec = edge.getContext('2d')!
  ec.fillStyle = base
  ec.fillRect(0, 0, 256, 48)
  ec.fillStyle = accent
  const dashes = 9
  for (let i = 0; i < dashes; i++) {
    ec.fillRect(i * (256 / dashes) + 256 / dashes / 2 - 7, 9, 14, 30)
  }
  const edgeTex = new THREE.CanvasTexture(edge)
  edgeTex.wrapS = THREE.RepeatWrapping
  edgeTex.repeat.set(3, 1)

  return { topTex, edgeTex }
}

interface ChipScheme {
  base: string
  accent: string
}

interface ChipStackProps {
  amount: number
  anchor: THREE.Vector3
  scheme: ChipScheme
  /** Direction the chips are tossed in FROM (added to each chip's rest pos). */
  toss: [number, number, number]
}

function ChipStack({ amount, anchor, scheme, toss }: ChipStackProps) {
  const group = useRef<THREE.Group>(null!)
  // Smoothly animated visible chip count (fractional) — also drives the toss.
  const visible = useRef(0)

  const targetCount = useMemo(
    () => THREE.MathUtils.clamp(Math.round(amount / CHIP_DENOM), 0, MAX_CHIPS),
    [amount],
  )

  // Per-chip resting jitter, spin and toss origin — stable frame to frame.
  const chips = useMemo(
    () =>
      Array.from({ length: MAX_CHIPS }, (_, i) => ({
        x: jitter(i * 2 + 1) * 0.02,
        z: jitter(i * 2 + 7) * 0.02,
        rot: jitter(i * 3 + 13) * Math.PI,
        ox: toss[0] + jitter(i * 5 + 3) * 0.35,
        oy: toss[1] + Math.abs(jitter(i * 7 + 9)) * 0.3,
        oz: toss[2] + jitter(i * 11 + 5) * 0.35,
        spin: 4 + Math.abs(jitter(i * 13 + 2)) * 6,
        tumble: jitter(i * 17 + 4),
      })),
    [toss],
  )

  const materials = useMemo(() => {
    const { topTex, edgeTex } = makeChipTextures(
      scheme.base,
      scheme.accent,
      String(CHIP_DENOM),
    )
    const emissive = new THREE.Color(scheme.base)
    const face = new THREE.MeshStandardMaterial({
      map: topTex,
      emissive,
      emissiveMap: topTex,
      emissiveIntensity: 0.3,
      roughness: 0.55,
      metalness: 0.12,
    })
    const side = new THREE.MeshStandardMaterial({
      map: edgeTex,
      emissive,
      emissiveMap: edgeTex,
      emissiveIntensity: 0.22,
      roughness: 0.6,
      metalness: 0.12,
    })
    // CylinderGeometry material groups: [side, top cap, bottom cap].
    return [side, face, face]
  }, [scheme.base, scheme.accent])

  useFrame((_, delta) => {
    visible.current = THREE.MathUtils.damp(visible.current, targetCount, 9, delta)
    if (!group.current) return
    const n = visible.current

    group.current.children.forEach((child, i) => {
      const c = chips[i]
      const t = THREE.MathUtils.clamp(n - i, 0, 1)
      const s = THREE.MathUtils.clamp(t * 1.4, 0, 1)
      child.scale.setScalar(s)
      child.visible = s > 0.001
      if (s <= 0.001) return

      // Toss arc: ease from the bettor's side toward the rest slot.
      const ease = 1 - Math.pow(1 - t, 2)
      const restX = c.x
      const restY = CHIP_HEIGHT * (i + 0.5)
      const restZ = c.z
      child.position.set(
        THREE.MathUtils.lerp(restX + c.ox, restX, ease),
        THREE.MathUtils.lerp(restY + c.oy, restY, ease) +
          Math.sin(ease * Math.PI) * 0.22,
        THREE.MathUtils.lerp(restZ + c.oz, restZ, ease),
      )
      // Spin + tumble while airborne, settling flat as it lands.
      child.rotation.y = c.rot + (1 - ease) * c.spin
      child.rotation.x = (1 - ease) * c.tumble * 1.4
      child.rotation.z = (1 - ease) * c.tumble * 0.6
    })
  })

  if (targetCount === 0) return null

  return (
    <group ref={group} position={[anchor.x, TABLE.surfaceY, anchor.z]}>
      {chips.map((_, i) => (
        <mesh key={i} castShadow receiveShadow material={materials}>
          <cylinderGeometry args={[CHIP_RADIUS, CHIP_RADIUS, CHIP_HEIGHT, 28]} />
        </mesh>
      ))}
    </group>
  )
}

// Casino colour schemes tuned to the dark, smoky table.
const SCHEME = {
  pot: { base: '#1b1410', accent: THEME.brass }, // black & brass
  player: { base: '#7c1717', accent: '#e9dcc0' }, // blood red & bone
  dealer: { base: '#123a26', accent: '#cfe9c0' }, // sickly green & bone
}

export function Chips() {
  const hand = useGame((s) => s.hand)
  if (!hand) return null

  return (
    <group>
      <ChipStack
        amount={hand.pot}
        anchor={CHIP_ANCHOR.pot}
        scheme={SCHEME.pot}
        toss={[0, 0.9, 0]}
      />
      <ChipStack
        amount={hand.player.committed}
        anchor={CHIP_ANCHOR.player}
        scheme={SCHEME.player}
        toss={[0, 0.55, 0.95]}
      />
      <ChipStack
        amount={hand.dealer.committed}
        anchor={CHIP_ANCHOR.dealer}
        scheme={SCHEME.dealer}
        toss={[0, 0.55, -0.95]}
      />
    </group>
  )
}
