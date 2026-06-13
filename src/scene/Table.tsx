import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { TABLE, THEME, communityPos } from './layout'

const FELT_THICKNESS = 0.06
const RIVET_COUNT = 48
const RIM_TUBE = 0.07

/**
 * A round steampunk poker table. The felt top surface sits at y = TABLE.surfaceY (0),
 * framed by a glowing brass rim studded with rivets, descending into darkness on a
 * tapered pedestal. A faint emissive inlay ring frames the community-card row.
 */
export function Table() {
  const rimRef = useRef<THREE.Mesh>(null!)
  const inlayRef = useRef<THREE.MeshStandardMaterial>(null!)

  // Rivet transforms around the rim, computed once.
  const rivets = useMemo(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3(1, 1, 1)
    const up = new THREE.Vector3(0, 1, 0)
    const list: THREE.Matrix4[] = []
    for (let i = 0; i < RIVET_COUNT; i++) {
      const a = (i / RIVET_COUNT) * Math.PI * 2
      const x = Math.cos(a) * TABLE.rimRadius
      const z = Math.sin(a) * TABLE.rimRadius
      const p = new THREE.Vector3(x, RIM_TUBE * 0.55, z)
      q.setFromUnitVectors(up, new THREE.Vector3(0, 1, 0))
      list.push(m.clone().compose(p, q, s))
    }
    return list
  }, [])

  const rivetMeshRef = useRef<THREE.InstancedMesh>(null!)

  // The radius at which the inlay ring frames the community row.
  const inlayRadius = useMemo(() => {
    const edge = communityPos(0) // leftmost community card x
    return Math.abs(edge[0]) + 0.55
  }, [])

  useFrame((state) => {
    // Subtle ember breathing on the brass rim + inlay so Bloom flickers like firelight.
    const t = state.clock.elapsedTime
    const pulse = 0.35 + 0.15 * Math.sin(t * 1.3) + 0.05 * Math.sin(t * 4.7)
    if (rimRef.current) {
      const mat = rimRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = pulse * 0.5
    }
    if (inlayRef.current) {
      inlayRef.current.emissiveIntensity = 0.6 + 0.3 * Math.sin(t * 1.1)
    }
  })

  return (
    <group>
      {/* Felt top — top face flush with y = 0 */}
      <mesh position={[0, -FELT_THICKNESS / 2, 0]} receiveShadow>
        <cylinderGeometry args={[TABLE.radius, TABLE.radius, FELT_THICKNESS, 96]} />
        <meshStandardMaterial color={THEME.felt} roughness={0.95} metalness={0.0} />
      </mesh>

      {/* Darker felt underside edge band to give the lip some depth */}
      <mesh position={[0, -FELT_THICKNESS - 0.06, 0]}>
        <cylinderGeometry args={[TABLE.radius * 0.995, TABLE.radius * 0.93, 0.12, 96]} />
        <meshStandardMaterial color={THEME.feltEdge} roughness={1.0} metalness={0.05} />
      </mesh>

      {/* Raised brass outer rim ring at the felt edge */}
      <mesh ref={rimRef} position={[0, 0.01, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[TABLE.rimRadius, RIM_TUBE, 20, 128]} />
        <meshStandardMaterial
          color={THEME.brass}
          metalness={0.9}
          roughness={0.35}
          emissive={THEME.emberDim}
          emissiveIntensity={0.18}
        />
      </mesh>

      {/* Inner darker brass lip framing where the felt meets the rim */}
      <mesh position={[0, -0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[TABLE.radius + 0.02, 0.03, 12, 128]} />
        <meshStandardMaterial color={THEME.brassDark} metalness={0.85} roughness={0.5} />
      </mesh>

      {/* Ring of brass rivets around the rim */}
      <instancedMesh
        ref={(node) => {
          rivetMeshRef.current = node!
          if (node) {
            rivets.forEach((mtx, i) => node.setMatrixAt(i, mtx))
            node.instanceMatrix.needsUpdate = true
          }
        }}
        args={[undefined, undefined, RIVET_COUNT]}
        castShadow
      >
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial
          color={THEME.brass}
          metalness={0.95}
          roughness={0.3}
          emissive={THEME.emberDim}
          emissiveIntensity={0.1}
        />
      </instancedMesh>

      {/* Faint emissive inlaid circle line on the felt framing the community row */}
      <mesh position={[0, 0.002, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[inlayRadius, 0.006, 8, 160]} />
        <meshStandardMaterial
          ref={inlayRef}
          color={THEME.brass}
          metalness={0.6}
          roughness={0.4}
          emissive={THEME.brass}
          emissiveIntensity={0.7}
          toneMapped={false}
        />
      </mesh>

      {/* Pedestal: tapered cylinder descending into darkness */}
      <mesh position={[0, -1.0, 0]} castShadow>
        <cylinderGeometry args={[1.1, 0.75, 1.9, 32]} />
        <meshStandardMaterial color={THEME.brassDark} metalness={0.55} roughness={0.7} />
      </mesh>

      {/* Heavy base foot at the bottom, sinking out of light */}
      <mesh position={[0, -2.1, 0]}>
        <cylinderGeometry args={[0.95, 1.4, 0.4, 32]} />
        <meshStandardMaterial color="#1a120a" metalness={0.4} roughness={0.85} />
      </mesh>
    </group>
  )
}
