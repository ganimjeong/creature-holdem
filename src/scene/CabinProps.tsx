// Real CC0 props (Poly Haven, CC0) dressing the cabin: an antique lantern on the
// table, an old rocking chair, stacked wooden crates, and a shelf against the
// wall. Each model is auto-normalised to a target height via its bounding box
// (so we don't need to know its native scale) and rested on the floor.

import { useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'

const FLOOR = -2.2

const URL = {
  lantern: '/assets/models/Lantern_01/Lantern_01_1k.gltf',
  crate: '/assets/models/CheeseBox_01/CheeseBox_01_1k.gltf',
  chair: '/assets/models/Rockingchair_01/Rockingchair_01_1k.gltf',
  shelf: '/assets/models/Shelf_01/Shelf_01_1k.gltf',
}

interface PropProps {
  url: string
  position: [number, number, number]
  rotationY?: number
  /** Target world-space height; the model is scaled to match. */
  height: number
}

function Prop({ url, position, rotationY = 0, height }: PropProps) {
  const { scene } = useGLTF(url)
  const obj = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
    return c
  }, [scene])

  // Normalise to `height` and rest the model's base at position.y.
  const { scale, yOffset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(obj)
    const size = new THREE.Vector3()
    box.getSize(size)
    const s = height / (size.y || 1)
    return { scale: s, yOffset: -box.min.y * s }
  }, [obj, height])

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <primitive object={obj} scale={scale} position={[0, yOffset, 0]} />
    </group>
  )
}

export function CabinProps() {
  return (
    <group>
      {/* Old rocking chair, angled toward the table in the left corner. */}
      <Prop url={URL.chair} position={[-4.6, FLOOR, -3.2]} rotationY={0.8} height={2.4} />

      {/* Shelf against the right wall. */}
      <Prop url={URL.shelf} position={[6.7, FLOOR, -1.8]} rotationY={-Math.PI / 2} height={3.4} />

      {/* Stacked wooden crates in the right-back corner. */}
      <Prop url={URL.crate} position={[4.9, FLOOR, -5.0]} rotationY={0.4} height={1.1} />
      <Prop url={URL.crate} position={[4.7, FLOOR + 1.1, -4.7]} rotationY={1.2} height={1.0} />
      <Prop url={URL.crate} position={[5.9, FLOOR, -4.1]} rotationY={-0.3} height={0.9} />

      {/* Antique lantern resting on the table, with its own warm glow. */}
      <Prop url={URL.lantern} position={[1.3, 0, 0.25]} rotationY={0.5} height={0.95} />
      <pointLight position={[1.3, 0.55, 0.25]} color={'#ffb24d'} intensity={3.2} distance={3.4} decay={2} />
    </group>
  )
}

useGLTF.preload(URL.lantern)
useGLTF.preload(URL.crate)
useGLTF.preload(URL.chair)
useGLTF.preload(URL.shelf)
