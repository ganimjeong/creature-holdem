// In-canvas reactive effects driven by store fx pulses. A single flash pointLight,
// a decaying camera shake, and a pooled ember/particle burst at table center.
// Everything is transient: parameters are set on a new pulse, then decayed each
// frame so the rig idles cheaply when nothing is happening.

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGame } from '../game/store/gameStore'
import { THEME } from './layout'
import { cameraBus } from './cameraBus'

const PARTICLE_COUNT = 60
const PARTICLE_LIFE = 1.2 // seconds

interface ParticleState {
  /** Per-particle elapsed life; >= maxLife means dead. */
  age: Float32Array
  maxLife: Float32Array
  velocity: Float32Array // xyz per particle
  baseSize: Float32Array
  alive: boolean
}

export function FxRig() {
  // Track which pulse we've already consumed so each fires exactly once.
  const lastFxId = useRef<number>(-1)

  // --- camera shake (decaying amplitude; written to the shared camera bus) ---
  const shake = useRef(0)
  const shakeFreq = useRef(34)
  const shakeTime = useRef(0)

  // --- flash point light (intensity + color decayed each frame) ---
  const flashLight = useRef<THREE.PointLight>(null!)
  const flashIntensity = useRef(0)
  const flashDecay = useRef(4) // per-second multiplier basis
  const flashColor = useRef(new THREE.Color(THEME.ember))

  // --- dark downward pulse (negative-ish mood dip via a separate cold light) ---
  const darkLight = useRef<THREE.PointLight>(null!)
  const darkIntensity = useRef(0)

  // --- particle burst (THREE.Points, additive emissive) ---
  const points = useRef<THREE.Points>(null!)
  const emberColor = useMemo(() => new THREE.Color(THEME.ember), [])

  const particles = useRef<ParticleState>({
    age: new Float32Array(PARTICLE_COUNT).fill(PARTICLE_LIFE + 1),
    maxLife: new Float32Array(PARTICLE_COUNT).fill(PARTICLE_LIFE),
    velocity: new Float32Array(PARTICLE_COUNT * 3),
    baseSize: new Float32Array(PARTICLE_COUNT).fill(0.06),
    alive: false,
  })

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const sizes = new Float32Array(PARTICLE_COUNT).fill(0)
    const alpha = new Float32Array(PARTICLE_COUNT).fill(0)
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1))
    return geo
  }, [])

  const material = useMemo(() => {
    // Round, soft, additive emissive sprite via a tiny shader so each particle
    // can fade and shrink independently — Bloom catches the bright core.
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: emberColor.clone() },
      },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float r = length(d);
          if (r > 0.5) discard;
          float core = smoothstep(0.5, 0.0, r);
          gl_FragColor = vec4(uColor * (0.6 + core * 1.6), core * vAlpha);
        }
      `,
    })
  }, [emberColor])

  /** Launch / relaunch the ember burst from ~[0,0.1,0]. */
  function launchBurst(scale: number, color: THREE.Color, upward: boolean) {
    const p = particles.current
    p.alive = true
    ;(material.uniforms.uColor.value as THREE.Color).copy(color)

    const pos = geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3
      // origin with a touch of jitter
      pos.array[i3 + 0] = (Math.random() - 0.5) * 0.18
      pos.array[i3 + 1] = 0.1 + Math.random() * 0.05
      pos.array[i3 + 2] = (Math.random() - 0.5) * 0.18

      // outward in xz, strong (or downward) in y
      const ang = Math.random() * Math.PI * 2
      const outward = (0.6 + Math.random() * 1.1) * scale
      const ySpeed = upward
        ? (1.6 + Math.random() * 1.8) * scale
        : -(0.4 + Math.random() * 0.8) * scale
      p.velocity[i3 + 0] = Math.cos(ang) * outward
      p.velocity[i3 + 1] = ySpeed
      p.velocity[i3 + 2] = Math.sin(ang) * outward

      p.age[i] = 0
      p.maxLife[i] = PARTICLE_LIFE * (0.7 + Math.random() * 0.5)
      p.baseSize[i] = (0.05 + Math.random() * 0.07) * scale
    }
    pos.needsUpdate = true
  }

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05) // clamp on hitches

    // --- consume a new pulse ---
    const fx = useGame.getState().fx
    if (fx && fx.id !== lastFxId.current) {
      lastFxId.current = fx.id
      switch (fx.type) {
        case 'win':
        case 'bigHand':
        case 'roundWin': {
          const big = fx.type !== 'win'
          shake.current = big ? 0.16 : 0.1
          shakeFreq.current = 30
          flashColor.current.set(THEME.ember)
          flashIntensity.current = big ? 9 : 5.5
          flashDecay.current = 3.4
          launchBurst(big ? 1.5 : 1.0, emberColor.clone(), true)
          break
        }
        case 'lose':
        case 'death': {
          const fatal = fx.type === 'death'
          shake.current = fatal ? 0.32 : 0.22
          shakeFreq.current = 22 // slower, heavier
          flashColor.current.set(THEME.bloodGlow)
          flashIntensity.current = fatal ? 11 : 7
          flashDecay.current = fatal ? 1.8 : 2.6
          // quick dark downward pulse
          darkIntensity.current = fatal ? 8 : 5
          launchBurst(fatal ? 1.3 : 0.9, new THREE.Color(THEME.bloodGlow), false)
          break
        }
        case 'allin': {
          shake.current = 0.13
          shakeFreq.current = 44 // short + sharp
          flashColor.current.set(THEME.ember)
          flashIntensity.current = 3.5
          flashDecay.current = 5.5
          launchBurst(0.7, emberColor.clone(), true)
          break
        }
        case 'ritual': {
          // A sickly green surge as a ritual fires.
          shake.current = 0.08
          shakeFreq.current = 38
          flashColor.current.set(THEME.creatureGlow)
          flashIntensity.current = 4.5
          flashDecay.current = 4.5
          launchBurst(0.8, new THREE.Color(THEME.creatureGlow), true)
          break
        }
        case 'victory': {
          // A triumphant golden eruption.
          shake.current = 0.2
          shakeFreq.current = 26
          flashColor.current.set(THEME.candle)
          flashIntensity.current = 12
          flashDecay.current = 2.2
          launchBurst(1.8, new THREE.Color(THEME.candle), true)
          break
        }
        case 'deal':
        default:
          // negligible
          break
      }
    }

    // --- camera shake -> camera bus (CameraRig composes it into the camera) ---
    if (shake.current > 0.0008) {
      shakeTime.current += delta
      const amt = shake.current
      const t = shakeTime.current
      // layered sine + slight randomness for an organic jolt
      cameraBus.shake.set(
        Math.sin(t * shakeFreq.current) * amt + (Math.random() - 0.5) * amt * 0.5,
        Math.cos(t * shakeFreq.current * 0.8) * amt * 0.8 +
          (Math.random() - 0.5) * amt * 0.4,
        Math.sin(t * shakeFreq.current * 1.3) * amt * 0.5,
      )
      // exponential-ish decay
      shake.current = THREE.MathUtils.damp(shake.current, 0, 3.2, delta)
    } else if (shake.current !== 0) {
      // settle exactly back to zero
      shake.current = 0
      shakeTime.current = 0
      cameraBus.shake.set(0, 0, 0)
    }

    // --- flash light decay ---
    if (flashLight.current) {
      flashLight.current.color.copy(flashColor.current)
      if (flashIntensity.current > 0.01) {
        flashIntensity.current = THREE.MathUtils.damp(
          flashIntensity.current,
          0,
          flashDecay.current,
          delta,
        )
      } else {
        flashIntensity.current = 0
      }
      flashLight.current.intensity = flashIntensity.current
    }

    // --- dark downward pulse decay ---
    if (darkLight.current) {
      if (darkIntensity.current > 0.01) {
        darkIntensity.current = THREE.MathUtils.damp(
          darkIntensity.current,
          0,
          4.5,
          delta,
        )
      } else {
        darkIntensity.current = 0
      }
      darkLight.current.intensity = darkIntensity.current
    }

    // --- particles ---
    const p = particles.current
    if (p.alive) {
      const pos = geometry.getAttribute('position') as THREE.BufferAttribute
      const size = geometry.getAttribute('size') as THREE.BufferAttribute
      const alpha = geometry.getAttribute('alpha') as THREE.BufferAttribute
      let anyAlive = false

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3
        if (p.age[i] >= p.maxLife[i]) {
          size.array[i] = 0
          alpha.array[i] = 0
          continue
        }
        anyAlive = true
        p.age[i] += delta

        // gravity + light drag
        p.velocity[i3 + 1] -= 2.6 * delta
        p.velocity[i3 + 0] *= 1 - 0.9 * delta
        p.velocity[i3 + 2] *= 1 - 0.9 * delta

        pos.array[i3 + 0] += p.velocity[i3 + 0] * delta
        pos.array[i3 + 1] += p.velocity[i3 + 1] * delta
        pos.array[i3 + 2] += p.velocity[i3 + 2] * delta

        const lifeT = Math.min(p.age[i] / p.maxLife[i], 1)
        const fade = 1 - lifeT
        size.array[i] = p.baseSize[i] * (0.4 + fade * 0.6) * 14
        alpha.array[i] = fade * fade
      }

      pos.needsUpdate = true
      size.needsUpdate = true
      alpha.needsUpdate = true
      if (!anyAlive) p.alive = false
    }
  })

  return (
    <group>
      <pointLight
        ref={flashLight}
        position={[0, 2, 0]}
        intensity={0}
        distance={9}
        decay={2}
        color={THEME.ember}
      />
      <pointLight
        ref={darkLight}
        position={[0, 0.4, 0]}
        intensity={0}
        distance={5}
        decay={2}
        color={THEME.cold}
      />
      <points ref={points} geometry={geometry} material={material} frustumCulled={false} />
    </group>
  )
}
