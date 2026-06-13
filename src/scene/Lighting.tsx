import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { THEME } from './layout'

const KEY_BASE = 14

/**
 * Very dark stage lighting: only the felt and the creature's silhouette emerge
 * from black. A warm candle key over the table center (flickering), a faint cold
 * ambient, and a cold back-rim that traces the creature's outline.
 */
export function Lighting() {
  const key = useRef<THREE.PointLight>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    // Layered sine noise for a living, uneasy candle flicker. Small amplitude so
    // the table never blows out, just breathes.
    const flicker =
      Math.sin(t * 11.3) * 0.55 +
      Math.sin(t * 17.9 + 1.7) * 0.32 +
      Math.sin(t * 29.1 + 4.2) * 0.18 +
      Math.sin(t * 4.3) * 0.45
    key.current.intensity = KEY_BASE + flicker
    // A barely-there positional jitter sells the guttering flame.
    key.current.position.x = Math.sin(t * 8.7) * 0.025
    key.current.position.z = 0.4 + Math.cos(t * 6.1) * 0.025
  })

  return (
    <>
      {/* Faint cold fill so deep shadows read as cold-blue rather than dead black. */}
      <ambientLight intensity={0.11} color={THEME.cold} />

      {/* Warm candle key hanging over the table center. Tight falloff via decay so
          the corners of the room stay pitch black. */}
      <pointLight
        ref={key}
        position={[0, 3.4, 0.4]}
        color={THEME.candle}
        intensity={KEY_BASE}
        distance={11}
        decay={2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-camera-near={0.4}
        shadow-camera-far={9}
        shadow-radius={4}
      />

      {/* Soft warm fill over the player's seat so the hole cards read clearly
          without lifting the rest of the gloom. Tight distance keeps it local. */}
      <pointLight
        position={[0, 1.5, 2.6]}
        color={THEME.candle}
        intensity={3.2}
        distance={3.4}
        decay={2}
      />

      {/* Cold rim behind the creature to trace its silhouette against black. */}
      <pointLight
        position={[0, 2.2, -4.6]}
        color={THEME.cold}
        intensity={3.6}
        distance={7.5}
        decay={2}
      />

      {/* Dim cold front-fill grazing the creature so its form reads faintly
          without lifting the table's gloom. */}
      <pointLight
        position={[0, 2.4, -1.9]}
        color={THEME.cold}
        intensity={1.1}
        distance={3.4}
        decay={2.2}
      />

      {/* A whisper of sickly creature glow rising from the far edge, reinforcing
          the rim without spilling onto the felt. */}
      <pointLight
        position={[0, 1.2, -3.2]}
        color={THEME.creatureGlow}
        intensity={0.7}
        distance={3.4}
        decay={2.4}
      />
    </>
  )
}
