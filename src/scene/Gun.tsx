// When the player loses a hand, the creature answers with a rusted revolver:
// it rises over the felt, levels at the player (the camera), spits a muzzle
// flash, and recoils — then sinks back into the dark. Driven by the store's
// 'lose' / 'death' fx pulses; the bang's shake/red-flash come from FxRig.

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { useGame } from '../game/store/gameStore'

const RUST = '#5b4326'
const RUST_DARK = '#2e2113'
const STEEL = '#6b6258'

// Timeline (seconds).
const T_RAISE = 0.28
const T_FIRE = 0.36
const T_LOWER_START = 1.15
const T_END = 1.7

const REST_Y = -1.6 // hidden below the table
const AIM_Y = 0.72 // levelled over the felt

export function Gun() {
  const { camera } = useThree()
  const fx = useGame((s) => s.fx)

  const root = useRef<THREE.Group>(null!)
  const flash = useRef<THREE.PointLight>(null!)
  const flashMesh = useRef<THREE.Mesh>(null!)

  const lastFxId = useRef(0)
  const firing = useRef(false)
  const timer = useRef(0)
  const fatal = useRef(false)

  // The creature's "hand" — where the gun lives, off to the dealer's side.
  const handX = 0.95
  const handZ = -1.15

  const camPos = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, delta) => {
    const g = root.current
    if (!g) return

    // --- trigger on a new lose/death pulse ---
    if (fx && fx.id !== lastFxId.current) {
      lastFxId.current = fx.id
      if (fx.type === 'lose' || fx.type === 'death') {
        firing.current = true
        timer.current = 0
        fatal.current = fx.type === 'death'
      }
    }

    if (!firing.current) {
      // Resting: hidden below the felt.
      g.visible = false
      if (flash.current) flash.current.intensity = 0
      return
    }

    g.visible = true
    timer.current += delta
    const t = timer.current

    // Vertical pose: rise -> hold -> sink.
    let y = AIM_Y
    if (t < T_RAISE) {
      const r = t / T_RAISE
      y = THREE.MathUtils.lerp(REST_Y, AIM_Y, 1 - Math.pow(1 - r, 3))
    } else if (t > T_LOWER_START) {
      const r = THREE.MathUtils.clamp((t - T_LOWER_START) / (T_END - T_LOWER_START), 0, 1)
      y = THREE.MathUtils.lerp(AIM_Y, REST_Y, r * r)
    }
    g.position.set(handX, y, handZ)

    // Aim the muzzle (built along -Z) at the player/camera.
    camPos.copy(camera.position)
    g.lookAt(camPos)

    // Recoil: a sharp kick just after the shot, decaying quickly. Applied as a
    // local backward shove + muzzle-up tilt on top of the aim.
    let recoil = 0
    if (t > T_FIRE) {
      recoil = Math.max(0, 1 - (t - T_FIRE) / 0.45)
      recoil = recoil * recoil
    }
    g.rotateX(recoil * -0.5) // kick muzzle up
    g.translateZ(recoil * 0.18) // shove back (local +Z is away from camera)

    // Muzzle flash: a hard spike at the shot that decays fast.
    let flashI = 0
    if (t > T_FIRE && t < T_FIRE + 0.16) {
      flashI = (1 - (t - T_FIRE) / 0.16) * (fatal.current ? 22 : 15)
    }
    if (flash.current) flash.current.intensity = flashI
    if (flashMesh.current) {
      const s = flashI > 0.1 ? 0.12 + flashI * 0.02 : 0
      flashMesh.current.scale.setScalar(s)
      flashMesh.current.visible = s > 0.001
    }

    if (t >= T_END) {
      firing.current = false
      g.visible = false
    }
  })

  return (
    <group ref={root} position={[handX, REST_Y, handZ]} visible={false}>
      {/* The gun is modelled pointing along -Z so lookAt(camera) levels it. */}
      {/* Barrel. */}
      <mesh position={[0, 0.02, -0.3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.05, 0.55, 16]} />
        <meshStandardMaterial color={RUST} roughness={0.85} metalness={0.55} />
      </mesh>
      {/* Barrel underlug. */}
      <mesh position={[0, -0.04, -0.28]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.028, 0.028, 0.42, 10]} />
        <meshStandardMaterial color={RUST_DARK} roughness={0.9} metalness={0.5} />
      </mesh>
      {/* Cylinder / chamber. */}
      <mesh position={[0, 0.0, -0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.085, 0.085, 0.16, 14]} />
        <meshStandardMaterial color={STEEL} roughness={0.7} metalness={0.6} />
      </mesh>
      {/* Frame block. */}
      <mesh position={[0, -0.02, 0.06]} castShadow>
        <boxGeometry args={[0.07, 0.13, 0.18]} />
        <meshStandardMaterial color={RUST} roughness={0.85} metalness={0.5} />
      </mesh>
      {/* Hammer. */}
      <mesh position={[0, 0.08, 0.12]}>
        <boxGeometry args={[0.03, 0.05, 0.04]} />
        <meshStandardMaterial color={RUST_DARK} roughness={0.9} metalness={0.5} />
      </mesh>
      {/* Grip, raked back and down. */}
      <mesh position={[0, -0.16, 0.16]} rotation={[0.5, 0, 0]} castShadow>
        <boxGeometry args={[0.06, 0.24, 0.09]} />
        <meshStandardMaterial color={'#3a2a18'} roughness={0.95} metalness={0.2} />
      </mesh>
      {/* Trigger guard. */}
      <mesh position={[0, -0.08, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.05, 0.012, 8, 16, Math.PI]} />
        <meshStandardMaterial color={RUST_DARK} roughness={0.9} metalness={0.5} />
      </mesh>

      {/* Muzzle flash: emissive burst + a hard light at the barrel tip. */}
      <mesh ref={flashMesh} position={[0, 0.02, -0.6]} visible={false}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial
          color={'#ffdf9a'}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <pointLight
        ref={flash}
        position={[0, 0.02, -0.62]}
        color={'#ffcf6e'}
        intensity={0}
        distance={6}
        decay={2}
      />
    </group>
  )
}
