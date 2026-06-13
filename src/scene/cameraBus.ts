import * as THREE from 'three'

// A tiny shared channel so multiple effects can influence the single camera
// without fighting over camera.position. FxRig writes a transient shake offset
// here; CameraRig is the sole writer of the camera, composing:
//   final = CAMERA.position + mouse parallax + shake
export const cameraBus = {
  /** Transient shake offset (world units), set by FxRig, decayed by FxRig. */
  shake: new THREE.Vector3(0, 0, 0),
}
