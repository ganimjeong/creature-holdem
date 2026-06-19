import { Component, ReactNode, Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGame } from '../game/store/gameStore'
import { DEALER_ANCHOR, THEME } from './layout'
import { CreatureModel } from './CreatureModel'

// Cached colors so we lerp without allocating per frame.
const EYE_BLOOD = new THREE.Color(THEME.bloodGlow)
const ROBE_COLOR = new THREE.Color('#16121c')

/**
 * The creature dealer. When an encounter is active it loads that creature's
 * rigged, animated GLB (CreatureModel); on the menu/map — or if a model fails to
 * load — it falls back to the original hand-built hooded silhouette. Either way
 * this component owns the looming BODY MOTION (breathing, leaning in to think,
 * lunging on a loss, recoiling on a win) and the two signature glow lights tinted
 * to the creature's eye color, so the reactive presence survives any model.
 */
export function CreatureDealer() {
  const thinking = useGame((s) => s.isDealerThinking)
  const fx = useGame((s) => s.fx)
  const creature = useGame((s) => s.creature)

  const eyeBase = useMemo(
    () => new THREE.Color(creature?.eyeColor ?? THEME.creatureGlow),
    [creature?.eyeColor],
  )

  // Root: handles breathing + lean + fx lunge for the whole creature.
  const root = useRef<THREE.Group>(null!)
  const glowL = useRef<THREE.PointLight>(null!)
  const glowR = useRef<THREE.PointLight>(null!)

  // FX impulse state (0 = rest). Positive = lean toward player (loss/death),
  // negative = recoil away (win). Driven by fx.id changes, decays in useFrame.
  const lunge = useRef(0)
  const flare = useRef(0) // 0..1 toward blood color
  const lastFxId = useRef(0)

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const dt = Math.min(delta, 0.05)

    // --- react to a new fx pulse by id change ---
    if (fx && fx.id !== lastFxId.current) {
      lastFxId.current = fx.id
      if (fx.type === 'lose' || fx.type === 'death') {
        lunge.current = fx.type === 'death' ? 1.0 : 0.7
        flare.current = 1.0
      } else if (fx.type === 'win' || fx.type === 'bigHand' || fx.type === 'roundWin') {
        lunge.current = -0.8
      }
    }

    // Impulses decay back to rest slowly (unsettling, not snappy).
    lunge.current = THREE.MathUtils.damp(lunge.current, 0, 1.6, dt)
    flare.current = THREE.MathUtils.damp(flare.current, 0, 1.1, dt)

    // --- body motion ---
    const breath = Math.sin(t * 0.55) * 0.05
    const drift = Math.sin(t * 0.23 + 1.3) * 0.035
    const leanTarget = (thinking ? 0.28 : 0) + lunge.current * 0.55

    if (root.current) {
      root.current.position.y = DEALER_ANCHOR.y + breath
      root.current.position.z = THREE.MathUtils.damp(
        root.current.position.z,
        DEALER_ANCHOR.z + leanTarget,
        4,
        dt,
      )
      const tiltTarget = (thinking ? 0.1 : 0) + lunge.current * 0.16
      root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, tiltTarget, 4, dt)
      root.current.rotation.y = drift * 0.6
    }

    // --- signature glow lights: pulse + color flare toward blood on a loss ---
    const pulseSpeed = thinking ? 3.2 : 1.4
    const pulseBase = thinking ? 2.2 : 1.3
    let intensity = pulseBase + Math.sin(t * pulseSpeed) * (thinking ? 1.0 : 0.45)
    intensity += flare.current * 2.4
    if (lunge.current < 0) intensity += lunge.current * 1.0
    intensity = Math.max(0.2, intensity)

    if (glowL.current && glowR.current) {
      glowL.current.intensity = intensity
      glowR.current.intensity = intensity
      glowL.current.color.copy(eyeBase).lerp(EYE_BLOOD, flare.current)
      glowR.current.color.copy(glowL.current.color)
    }
  })

  return (
    <group ref={root} position={DEALER_ANCHOR.toArray()}>
      {/* Two sickly lights flanking the creature's head height, tinted to its
          eye color — its glowing presence in the dark, reactive to wins/losses. */}
      <pointLight ref={glowL} position={[-0.5, 2.0, 0.5]} intensity={1.3} distance={4.5} decay={2} color={eyeBase} />
      <pointLight ref={glowR} position={[0.5, 2.0, 0.5]} intensity={1.3} distance={4.5} decay={2} color={eyeBase} />

      <ModelErrorBoundary fallback={<ProceduralFallback />}>
        <Suspense fallback={<ProceduralFallback />}>
          {creature ? (
            <CreatureModel key={creature.id} creature={creature} thinking={thinking} fx={fx} />
          ) : (
            <ProceduralFallback />
          )}
        </Suspense>
      </ModelErrorBoundary>
    </group>
  )
}

/** The original hand-built hooded silhouette — used on the menu and as a safety
 *  net if a creature's GLB ever fails to load. */
function ProceduralFallback() {
  const eyeZ = 0.34
  const headY = 2.05
  const eyeSpread = 0.16
  return (
    <group>
      <mesh position={[0, 0.9, 0]} castShadow>
        <coneGeometry args={[1.25, 3.6, 24, 1, true]} />
        <meshStandardMaterial color={ROBE_COLOR} roughness={1} metalness={0} emissive={'#0c0814'} emissiveIntensity={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 1.7, 0]}>
        <coneGeometry args={[0.95, 1.5, 20, 1, true]} />
        <meshStandardMaterial color={'#020102'} roughness={1} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, headY, 0.05]}>
        <sphereGeometry args={[0.42, 20, 16]} />
        <meshStandardMaterial color={'#030203'} roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0, headY + 0.34, -0.05]} rotation={[0.25, 0, 0]}>
        <coneGeometry args={[0.5, 0.9, 16, 1, true]} />
        <meshStandardMaterial color={ROBE_COLOR} roughness={1} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-eyeSpread, headY, eyeZ]}>
        <sphereGeometry args={[0.052, 12, 12]} />
        <meshStandardMaterial color={'#000000'} emissive={THEME.creatureGlow} emissiveIntensity={4} toneMapped={false} roughness={0.4} />
      </mesh>
      <mesh position={[eyeSpread, headY, eyeZ]}>
        <sphereGeometry args={[0.052, 12, 12]} />
        <meshStandardMaterial color={'#000000'} emissive={THEME.creatureGlow} emissiveIntensity={4} toneMapped={false} roughness={0.4} />
      </mesh>
    </group>
  )
}

/** Falls back to the procedural silhouette if a creature GLB throws while loading. */
class ModelErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
