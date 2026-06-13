// A dim timber cabin shell built around the table from real CC0 wood textures
// (Poly Haven, CC0): plank floor + ceiling, beam walls, ceiling joists, and a
// faint moonlit window behind the creature. The candle light barely reaches the
// walls, so they read as gloomy boards receding into the dark — and because it's
// real geometry, it parallaxes with the mouse-look camera.

import { useMemo } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { THEME } from './layout'

const FLOOR = -2.2
const CEIL = 4.8
const HALF_X = 8
const BACK_Z = -8.5
const FRONT_Z = 7.5
const MID_Y = (FLOOR + CEIL) / 2
const H = CEIL - FLOOR
const DEPTH = FRONT_Z - BACK_Z
const WIDTH = HALF_X * 2

function configure(
  t: THREE.Texture,
  repeatX: number,
  repeatY: number,
  srgb: boolean,
) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeatX, repeatY)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = 4
  return t
}

export function CabinRoom() {
  const tex = useTexture({
    floorMap: '/assets/textures/brown_planks_05/diff.jpg',
    floorNor: '/assets/textures/brown_planks_05/nor.jpg',
    floorRough: '/assets/textures/brown_planks_05/rough.jpg',
    wallMap: '/assets/textures/beam_wall_01/diff.jpg',
    wallNor: '/assets/textures/beam_wall_01/nor.jpg',
    wallRough: '/assets/textures/beam_wall_01/rough.jpg',
  })

  const { floorMat, wallMat } = useMemo(() => {
    configure(tex.floorMap, 6, 6, true)
    configure(tex.floorNor, 6, 6, false)
    configure(tex.floorRough, 6, 6, false)
    configure(tex.wallMap, 5, 2.5, true)
    configure(tex.wallNor, 5, 2.5, false)
    configure(tex.wallRough, 5, 2.5, false)

    const floorMat = new THREE.MeshStandardMaterial({
      map: tex.floorMap,
      normalMap: tex.floorNor,
      roughnessMap: tex.floorRough,
      color: '#7d6647',
      roughness: 1,
      metalness: 0,
    })
    const wallMat = new THREE.MeshStandardMaterial({
      map: tex.wallMap,
      normalMap: tex.wallNor,
      roughnessMap: tex.wallRough,
      color: '#6f5b3f',
      roughness: 1,
      metalness: 0,
    })
    return { floorMat, wallMat }
  }, [tex])

  return (
    <group>
      {/* Floor */}
      <mesh position={[0, FLOOR, -0.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={floorMat}>
        <planeGeometry args={[WIDTH + 8, DEPTH + 4]} />
      </mesh>

      {/* Ceiling (reuse plank material, no shadows needed) */}
      <mesh position={[0, CEIL, -0.5]} rotation={[Math.PI / 2, 0, 0]} material={floorMat}>
        <planeGeometry args={[WIDTH + 8, DEPTH + 4]} />
      </mesh>

      {/* Back wall (behind the creature) */}
      <mesh position={[0, MID_Y, BACK_Z]} material={wallMat}>
        <planeGeometry args={[WIDTH + 8, H]} />
      </mesh>
      {/* Front wall (behind the camera) */}
      <mesh position={[0, MID_Y, FRONT_Z]} rotation={[0, Math.PI, 0]} material={wallMat}>
        <planeGeometry args={[WIDTH + 8, H]} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-HALF_X, MID_Y, -0.5]} rotation={[0, Math.PI / 2, 0]} material={wallMat}>
        <planeGeometry args={[DEPTH + 4, H]} />
      </mesh>
      {/* Right wall */}
      <mesh position={[HALF_X, MID_Y, -0.5]} rotation={[0, -Math.PI / 2, 0]} material={wallMat}>
        <planeGeometry args={[DEPTH + 4, H]} />
      </mesh>

      {/* Ceiling joists */}
      {[-5, -1.5, 2, 5.5].map((z, i) => (
        <mesh key={i} position={[0, CEIL - 0.35, z]} castShadow>
          <boxGeometry args={[WIDTH + 6, 0.36, 0.46]} />
          <meshStandardMaterial color={'#2a2014'} roughness={1} metalness={0} />
        </mesh>
      ))}
      {/* A couple of upright corner posts */}
      {[[-HALF_X + 0.4, -5.5], [HALF_X - 0.4, -5.5], [-HALF_X + 0.4, 4.5], [HALF_X - 0.4, 4.5]].map(
        ([x, z], i) => (
          <mesh key={i} position={[x, MID_Y, z]} castShadow>
            <boxGeometry args={[0.5, H, 0.5]} />
            <meshStandardMaterial color={'#241a10'} roughness={1} metalness={0} />
          </mesh>
        ),
      )}

      {/* Boarded moonlit window on the back wall — backlights the creature. */}
      <mesh position={[-3.4, 1.4, BACK_Z + 0.08]}>
        <planeGeometry args={[2.4, 3.0]} />
        <meshBasicMaterial color={THEME.cold} transparent opacity={0.5} fog={false} />
      </mesh>
      {/* Window cross bars. */}
      <mesh position={[-3.4, 1.4, BACK_Z + 0.12]}>
        <boxGeometry args={[2.5, 0.12, 0.08]} />
        <meshStandardMaterial color={'#1a130c'} roughness={1} />
      </mesh>
      <mesh position={[-3.4, 1.4, BACK_Z + 0.12]}>
        <boxGeometry args={[0.12, 3.1, 0.08]} />
        <meshStandardMaterial color={'#1a130c'} roughness={1} />
      </mesh>
      {/* Cold moonlight spilling in through the window. */}
      <pointLight position={[-3.4, 1.6, BACK_Z + 1.2]} color={THEME.cold} intensity={2.2} distance={7} decay={2} />
    </group>
  )
}

useTexture.preload('/assets/textures/brown_planks_05/diff.jpg')
