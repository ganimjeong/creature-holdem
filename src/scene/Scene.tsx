import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import * as THREE from 'three'
import { CAMERA, THEME } from './layout'
import { Lighting } from './Lighting'
import { Atmosphere } from './Atmosphere'
import { Effects } from './Effects'
import { Table } from './Table'
import { Cards } from './Cards'
import { Chips } from './Chips'
import { CreatureDealer } from './CreatureDealer'
import { FxRig } from './FxRig'

/**
 * The 3D stage. A dark, fog-drowned steampunk table lit by a single low ember
 * light, with the creature dealer looming out of the black across the felt.
 */
export function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
        powerPreference: 'high-performance',
      }}
      camera={{
        position: CAMERA.position.toArray(),
        fov: CAMERA.fov,
        near: 0.1,
        far: 100,
      }}
      onCreated={({ camera }) => camera.lookAt(CAMERA.target)}
    >
      <color attach="background" args={[THEME.background]} />
      <fog attach="fog" args={[THEME.fog, 6, 16]} />

      <Suspense fallback={null}>
        <Lighting />
        <Atmosphere />
        <Table />
        <CreatureDealer />
        <Cards />
        <Chips />
        <FxRig />
      </Suspense>

      <Effects />
    </Canvas>
  )
}
