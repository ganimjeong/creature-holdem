import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGame } from '../game/store/gameStore'
import { CHIP_ANCHOR, TABLE, THEME } from './layout'

const CHIP_RADIUS = 0.14
const CHIP_HEIGHT = 0.03
const CHIP_DENOM = 25 // chips ≈ amount / denom
const MAX_CHIPS = 24

/** Deterministic pseudo-random in [-1, 1] from an integer seed. */
function jitter(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

interface ChipStackProps {
  amount: number
  anchor: THREE.Vector3
  color: string
}

function ChipStack({ amount, anchor, color }: ChipStackProps) {
  const group = useRef<THREE.Group>(null!)
  // Smoothly animated visible chip count (fractional) so the stack grows/shrinks.
  const visible = useRef(0)

  const targetCount = useMemo(
    () => THREE.MathUtils.clamp(Math.round(amount / CHIP_DENOM), 0, MAX_CHIPS),
    [amount],
  )

  // Pre-compute per-chip transforms so the hand-stacked look is stable frame to frame.
  const chips = useMemo(() => {
    return Array.from({ length: MAX_CHIPS }, (_, i) => ({
      x: jitter(i * 2 + 1) * 0.018,
      z: jitter(i * 2 + 7) * 0.018,
      rot: jitter(i * 3 + 13) * 0.5,
    }))
  }, [])

  const emissive = useMemo(() => new THREE.Color(color), [color])

  useFrame((_, delta) => {
    visible.current = THREE.MathUtils.damp(
      visible.current,
      targetCount,
      9,
      delta,
    )
    if (!group.current) return
    const n = visible.current
    group.current.children.forEach((child, i) => {
      // Fade each chip in/out by scaling as the fractional count crosses it.
      const t = THREE.MathUtils.clamp(n - i, 0, 1)
      child.scale.setScalar(t)
      child.visible = t > 0.001
    })
  })

  if (targetCount === 0) return null

  return (
    <group ref={group} position={[anchor.x, TABLE.surfaceY, anchor.z]}>
      {chips.map((c, i) => (
        <mesh
          key={i}
          castShadow
          position={[c.x, CHIP_HEIGHT * (i + 0.5), c.z]}
          rotation={[0, c.rot, 0]}
        >
          <cylinderGeometry
            args={[CHIP_RADIUS, CHIP_RADIUS, CHIP_HEIGHT, 24]}
          />
          <meshStandardMaterial
            color={color}
            metalness={0.6}
            roughness={0.4}
            emissive={emissive}
            emissiveIntensity={0.35}
          />
        </mesh>
      ))}
    </group>
  )
}

export function Chips() {
  const hand = useGame((s) => s.hand)
  if (!hand) return null

  return (
    <group>
      <ChipStack
        amount={hand.pot}
        anchor={CHIP_ANCHOR.pot}
        color={THEME.brass}
      />
      <ChipStack
        amount={hand.player.committed}
        anchor={CHIP_ANCHOR.player}
        color={THEME.ember}
      />
      <ChipStack
        amount={hand.dealer.committed}
        anchor={CHIP_ANCHOR.dealer}
        color={THEME.creatureGlow}
      />
    </group>
  )
}
