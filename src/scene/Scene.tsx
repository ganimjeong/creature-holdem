import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import * as THREE from 'three'
import { Environment } from '@react-three/drei'
import { CAMERA, THEME } from './layout'
import { Lighting } from './Lighting'
import { Atmosphere } from './Atmosphere'
import { Effects } from './Effects'
import { Table } from './Table'
import { Cards } from './Cards'
import { Chips } from './Chips'
import { CreatureDealer } from './CreatureDealer'
import { FxRig } from './FxRig'
import { Gun } from './Gun'
import { CameraRig } from './CameraRig'
import { CabinRoom } from './CabinRoom'
import { CabinProps } from './CabinProps'

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
      {/* Background comes from the dimmed hayloft HDRI (Environment, below).
          Fog only touches the foreground; the HDRI skybox stays crisp-ish. */}
      <fog attach="fog" args={[THEME.fog, 7, 18]} />

      <Suspense fallback={null}>
        {/* Hayloft HDRI now drives only subtle image-based fill (the timber
            cabin room below is the visible environment). */}
        <Environment files="/assets/hdri/hayloft_2k.hdr" environmentIntensity={0.28} />
        <Lighting />
        <Atmosphere />
        <CabinRoom />
        <CabinProps />
        <Table />
        <CreatureDealer />
        <Cards />
        <Chips />
        <Gun />
        <FxRig />
      </Suspense>

      {/* Sole camera writer: composes mouse parallax + FX shake. Mounted after
          FxRig so the shake bus is up to date when it reads it. */}
      <CameraRig />

      <Effects />
    </Canvas>
  )
}
