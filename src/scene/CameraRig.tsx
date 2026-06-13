// The single owner of the camera each frame. Adds a gentle mouse-look parallax
// (the view drifts within a small range toward the pointer for an immersive,
// "leaning in" feel) and layers in any transient shake from the FX bus. Keeping
// all camera writes here avoids two systems clobbering camera.position.

import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CAMERA } from './layout'
import { cameraBus } from './cameraBus'

// How far the camera may drift from its base on each axis.
const RANGE_X = 0.45
const RANGE_Y = 0.28
// How much the look target leans the opposite way (parallax depth).
const TARGET_LEAN = 0.18

export function CameraRig() {
  const offset = useRef(new THREE.Vector3())
  const lookOffset = useRef(new THREE.Vector3())
  const tmpTarget = useRef(new THREE.Vector3())

  useFrame((state, delta) => {
    const { pointer, camera } = state // pointer components are in [-1, 1]
    const k = 1 - Math.pow(0.0015, delta) // frame-rate-independent smoothing

    // Desired parallax offset from the pointer.
    const desiredX = pointer.x * RANGE_X
    const desiredY = pointer.y * RANGE_Y
    offset.current.x += (desiredX - offset.current.x) * k
    offset.current.y += (desiredY - offset.current.y) * k

    // The look target leans slightly opposite for a sense of depth.
    lookOffset.current.x += (-pointer.x * TARGET_LEAN - lookOffset.current.x) * k
    lookOffset.current.y += (pointer.y * TARGET_LEAN - lookOffset.current.y) * k

    camera.position.set(
      CAMERA.position.x + offset.current.x + cameraBus.shake.x,
      CAMERA.position.y + offset.current.y + cameraBus.shake.y,
      CAMERA.position.z + cameraBus.shake.z,
    )

    tmpTarget.current.set(
      CAMERA.target.x + lookOffset.current.x,
      CAMERA.target.y + lookOffset.current.y,
      CAMERA.target.z,
    )
    camera.lookAt(tmpTarget.current)
  })

  return null
}
