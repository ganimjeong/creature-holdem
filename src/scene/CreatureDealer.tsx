import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGame } from '../game/store/gameStore'
import { DEALER_ANCHOR, THEME } from './layout'

// Cached colors so we lerp without allocating per frame.
const EYE_BASE = new THREE.Color(THEME.creatureGlow)
const EYE_BLOOD = new THREE.Color(THEME.bloodGlow)
// Lifted just off pure black so the silhouette is faintly readable in the dark.
const ROBE_COLOR = new THREE.Color('#16121c')

/**
 * The creature dealer: a tall hooded silhouette looming behind the far table
 * edge, mostly swallowed by darkness with two glowing eyes. Built procedurally.
 * Idle breathing sway; leans in when thinking; surges forward + flares red on
 * the player's loss/death, recoils + dims on the player's wins.
 */
export function CreatureDealer() {
  const thinking = useGame((s) => s.isDealerThinking)
  const fx = useGame((s) => s.fx)

  // Root: handles breathing + lean + fx lunge.
  const root = useRef<THREE.Group>(null!)
  // Eye material(s): pulse + color flare.
  const eyeMatL = useRef<THREE.MeshStandardMaterial>(null!)
  const eyeMatR = useRef<THREE.MeshStandardMaterial>(null!)
  const eyeLightL = useRef<THREE.PointLight>(null!)
  const eyeLightR = useRef<THREE.PointLight>(null!)

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
      } else if (
        fx.type === 'win' ||
        fx.type === 'bigHand' ||
        fx.type === 'roundWin'
      ) {
        lunge.current = -0.8
      }
    }

    // Impulses decay back to rest slowly (unsettling, not snappy).
    lunge.current = THREE.MathUtils.damp(lunge.current, 0, 1.6, dt)
    flare.current = THREE.MathUtils.damp(flare.current, 0, 1.1, dt)

    // --- body motion ---
    const breath = Math.sin(t * 0.55) * 0.05
    const drift = Math.sin(t * 0.23 + 1.3) * 0.035
    // Thinking pulls the mass toward the player (+z); lunge adds an fx kick.
    const leanTarget = (thinking ? 0.28 : 0) + lunge.current * 0.55

    if (root.current) {
      root.current.position.y = DEALER_ANCHOR.y + breath
      root.current.position.z = THREE.MathUtils.damp(
        root.current.position.z,
        DEALER_ANCHOR.z + leanTarget,
        4,
        dt,
      )
      // Subtle tilt forward as it leans, plus a slow horizontal sway.
      const tiltTarget = (thinking ? 0.12 : 0) + lunge.current * 0.18
      root.current.rotation.x = THREE.MathUtils.damp(
        root.current.rotation.x,
        tiltTarget,
        4,
        dt,
      )
      root.current.rotation.y = drift * 0.6
    }

    // --- eyes: intensity pulse + color flare ---
    // Base sickly pulse; brighter & faster when thinking.
    const pulseSpeed = thinking ? 3.2 : 1.4
    const pulseBase = thinking ? 5.0 : 3.0
    const pulseAmp = thinking ? 2.2 : 0.9
    let intensity = pulseBase + Math.sin(t * pulseSpeed) * pulseAmp
    // Loss/death flare spikes brightness; wins dim the eyes.
    intensity += flare.current * 4.0
    if (lunge.current < 0) intensity += lunge.current * 2.6 // recoil -> dimmer

    intensity = Math.max(0.6, intensity)

    if (eyeMatL.current && eyeMatR.current) {
      // Color lerps from sickly green toward blood red during flare.
      eyeMatL.current.emissive.copy(EYE_BASE).lerp(EYE_BLOOD, flare.current)
      eyeMatR.current.emissive.copy(eyeMatL.current.emissive)
      eyeMatL.current.emissiveIntensity = intensity
      eyeMatR.current.emissiveIntensity = intensity
    }
    if (eyeLightL.current && eyeLightR.current) {
      const lightI = Math.max(0, intensity * 0.18)
      eyeLightL.current.intensity = lightI
      eyeLightR.current.intensity = lightI
      eyeLightL.current.color.copy(EYE_BASE).lerp(EYE_BLOOD, flare.current)
      eyeLightR.current.color.copy(eyeLightL.current.color)
    }
  })

  // Eyes sit at the lowered head; offsets reused for eyes + their lights.
  const headY = 2.05
  const eyeZ = 0.34
  const eyeSpread = 0.16

  return (
    <group ref={root} position={DEALER_ANCHOR.toArray()}>
      {/* --- robed body: a tall cloaked cone rising from below the table --- */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <coneGeometry args={[1.25, 3.6, 24, 1, true]} />
        <meshStandardMaterial
          color={ROBE_COLOR}
          roughness={1}
          metalness={0}
          emissive={'#0c0814'}
          emissiveIntensity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Inner darker cowl flare to deepen the silhouette around the shoulders. */}
      <mesh position={[0, 1.7, 0]}>
        <coneGeometry args={[0.95, 1.5, 20, 1, true]} />
        <meshStandardMaterial
          color={'#020102'}
          roughness={1}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* --- lowered hooded head: a small dark sphere set into the cowl --- */}
      <mesh position={[0, headY, 0.05]}>
        <sphereGeometry args={[0.42, 20, 16]} />
        <meshStandardMaterial color={'#030203'} roughness={1} metalness={0} />
      </mesh>

      {/* Hood peak overhanging the eyes, casting them into shadow. */}
      <mesh position={[0, headY + 0.34, -0.05]} rotation={[0.25, 0, 0]}>
        <coneGeometry args={[0.5, 0.9, 16, 1, true]} />
        <meshStandardMaterial
          color={ROBE_COLOR}
          roughness={1}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* --- glowing eyes --- */}
      <mesh position={[-eyeSpread, headY, eyeZ]}>
        <sphereGeometry args={[0.052, 12, 12]} />
        <meshStandardMaterial
          ref={eyeMatL}
          color={'#000000'}
          emissive={THEME.creatureGlow}
          emissiveIntensity={4}
          toneMapped={false}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[eyeSpread, headY, eyeZ]}>
        <sphereGeometry args={[0.052, 12, 12]} />
        <meshStandardMaterial
          ref={eyeMatR}
          color={'#000000'}
          emissive={THEME.creatureGlow}
          emissiveIntensity={4}
          toneMapped={false}
          roughness={0.4}
        />
      </mesh>

      {/* Tiny sickly point lights at each eye so the glow spills onto the felt. */}
      <pointLight
        ref={eyeLightL}
        position={[-eyeSpread, headY, eyeZ + 0.05]}
        color={THEME.creatureGlow}
        intensity={0.7}
        distance={2.4}
        decay={2}
      />
      <pointLight
        ref={eyeLightR}
        position={[eyeSpread, headY, eyeZ + 0.05]}
        color={THEME.creatureGlow}
        intensity={0.7}
        distance={2.4}
        decay={2}
      />

      {/* --- brass steampunk accents on shoulders / chest --- */}
      {/* Shoulder gears. */}
      <mesh position={[-0.72, 1.5, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.045, 8, 20]} />
        <meshStandardMaterial
          color={THEME.brass}
          metalness={0.9}
          roughness={0.35}
          emissive={THEME.emberDim}
          emissiveIntensity={0.25}
        />
      </mesh>
      <mesh position={[0.72, 1.5, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.045, 8, 20]} />
        <meshStandardMaterial
          color={THEME.brass}
          metalness={0.9}
          roughness={0.35}
          emissive={THEME.emberDim}
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* Smaller chest gear. */}
      <mesh position={[0, 1.15, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.12, 0.035, 8, 18]} />
        <meshStandardMaterial
          color={THEME.brassDark}
          metalness={0.9}
          roughness={0.4}
          emissive={THEME.emberDim}
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* A couple of thin vertical pipes flanking the chest. */}
      <mesh position={[-0.34, 1.35, 0.55]} rotation={[0.15, 0, 0.05]}>
        <cylinderGeometry args={[0.03, 0.03, 0.9, 10]} />
        <meshStandardMaterial
          color={THEME.brass}
          metalness={0.9}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0.34, 1.35, 0.55]} rotation={[0.15, 0, -0.05]}>
        <cylinderGeometry args={[0.03, 0.03, 0.9, 10]} />
        <meshStandardMaterial
          color={THEME.brass}
          metalness={0.9}
          roughness={0.35}
        />
      </mesh>
    </group>
  )
}
