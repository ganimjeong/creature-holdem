import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { THEME } from './layout'

/**
 * Floating dust and ember haze that gives the scene depth without ever feeling
 * busy: a broad, cold field of fine motes drifting through the whole room, a
 * tighter column of warm embers rising off the table, and a barely-there sheet
 * of ground fog turning slowly low over the floor.
 */
export function Atmosphere() {
  const fog = useRef<THREE.Mesh>(null!)

  useFrame((_, delta) => {
    // A slow, almost imperceptible drift so the ground haze never looks static.
    fog.current.rotation.z += delta * 0.015
  })

  return (
    <group>
      {/* Fine cold dust filling the whole space. */}
      <Sparkles
        count={120}
        scale={[10, 6, 10]}
        position={[0, 2.4, -0.7]}
        size={1.2}
        speed={0.2}
        opacity={0.25}
        color={THEME.cold}
        noise={0.6}
      />

      {/* Warm embers rising near the table center. */}
      <Sparkles
        count={40}
        scale={[4, 3, 4]}
        position={[0, 1.1, -0.5]}
        size={2}
        speed={0.4}
        opacity={0.5}
        color={THEME.ember}
        noise={1}
      />

      {/* Faint sheet of ground fog hugging the floor. */}
      <mesh
        ref={fog}
        position={[0, -0.32, -0.7]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[9, 48]} />
        <meshBasicMaterial
          color={THEME.fog}
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
