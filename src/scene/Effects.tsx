import * as THREE from 'three'
import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
  ChromaticAberration,
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

/**
 * Post-processing stack tuned for the dark steampunk-horror mood:
 * emissive eyes / embers / brass / chips bloom out of the gloom, a whisper of
 * chromatic fringing on the lens, a heavy vignette that swallows the corners,
 * and a faint film grain so the whole scene feels like candlelit nitrate film.
 */
export function Effects() {
  return (
    <EffectComposer multisampling={4}>
      {/* Let anything emissive (creature glow, embers, candles, chip metal) bleed light. */}
      <Bloom
        mipmapBlur
        luminanceThreshold={0.18}
        luminanceSmoothing={0.9}
        intensity={0.9}
      />

      {/* Subtle lens fringe — keeps it cinematic without going psychedelic. */}
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(0.0008, 0.0008)}
        radialModulation={false}
        modulationOffset={0}
      />

      {/* Deep, warm-dark falloff that pulls the eye to the felt and the creature. */}
      <Vignette eskil={false} offset={0.32} darkness={0.92} />

      {/* Quiet grain for that aged, oppressive texture. */}
      <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.045} />
    </EffectComposer>
  )
}
