// A rigged, animated creature dealer loaded from a CC0 Quaternius monster GLB
// (via poly.pizza). One generic loader drives every creature: it auto-normalises
// the model's size, tints it with the creature's signature glow, and switches
// animation clips by INTENT (idle / attack / flinch / taunt / death) so the
// thing actually MOVES with the game — it lunges when you lose a hand, flinches
// when you win one, and dies when you bust it.
//
// Clip vocabularies differ per monster (some have "Idle", flyers have
// "Flying_Idle"; attacks are "Headbutt" / "Bite_Front" / "Punch"), so each intent
// resolves to the first clip the model actually has.

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGLTF, useAnimations } from '@react-three/drei'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { Creature } from '../game/content/creatures'
import type { FxType } from '../game/store/gameStore'

const MODEL_URL = (id: string) => `/assets/models/creatures/${id}.glb`

// Preload the whole bestiary so swaps between encounters are instant.
;['gambler', 'hoarder', 'watcher', 'tithe', 'furnace', 'twin', 'leech', 'jester', 'maw'].forEach(
  (id) => useGLTF.preload(MODEL_URL(id)),
)

/** World height (in units) every creature is scaled to; boss/big creatures scale up. */
const BASE_HEIGHT = 2.5
/** Feet sit a touch below the table edge so the creature looms up out of the dark. */
const GROUND_Y = -0.55
/** Quaternius monsters face +Z; the player sits at +Z, so turn them to face the camera. */
const FACE_YAW = Math.PI

type Intent = 'idle' | 'attack' | 'flinch' | 'taunt' | 'death'

// Per-intent clip preference, matched by suffix against `CharacterArmature|<Clip>`.
const INTENT_CLIPS: Record<Intent, string[]> = {
  idle: ['Idle', 'Flying_Idle', 'Idle_A', 'Walk'],
  attack: ['Headbutt', 'Bite_Front', 'Punch', 'Weapon', 'Jump'],
  flinch: ['HitReact', 'HitRecieve', 'Duck', 'No'],
  taunt: ['Yes', 'Wave', 'Dance'],
  death: ['Death'],
}

const FX_INTENT: Partial<Record<FxType, Intent>> = {
  lose: 'attack', // you lost the hand → it lunges
  death: 'attack', // you died → it strikes
  win: 'flinch', // you won the hand → it recoils
  bigHand: 'flinch',
  roundWin: 'death', // you busted it → it falls
  allin: 'taunt',
  ritual: 'flinch',
}

interface Props {
  creature: Creature
  thinking: boolean
  fx: { type: FxType; id: number } | null
}

export function CreatureModel({ creature, thinking, fx }: Props) {
  const group = useRef<THREE.Group>(null!)
  const { scene, animations } = useGLTF(MODEL_URL(creature.id))

  // Clone so multiple/repeat encounters never fight over one shared graph, and so
  // we can recolour without mutating the cached original.
  const model = useMemo(() => {
    // SkeletonUtils.clone (NOT Object3D.clone) so skinned meshes rebind to a
    // fresh skeleton — otherwise the animation wouldn't deform the mesh.
    const root = skeletonClone(scene) as THREE.Group

    // Normalise size + footing from the model's bounding box.
    const box = new THREE.Box3().setFromObject(root)
    const size = new THREE.Vector3()
    box.getSize(size)
    const height = size.y || 1
    const scale = (BASE_HEIGHT * creature.scale) / height
    root.scale.setScalar(scale)

    // Recompute after scaling to plant the feet and centre horizontally.
    const box2 = new THREE.Box3().setFromObject(root)
    root.position.x -= (box2.min.x + box2.max.x) / 2
    root.position.z -= (box2.min.z + box2.max.z) / 2
    root.position.y -= box2.min.y

    // Tint each material toward the creature's signature hue + a faint self-glow,
    // and make sure it casts/receives the room's shadows.
    const tint = new THREE.Color(creature.eyeColor)
    root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mesh.material = mats.map((m) => {
        const mat = (m as THREE.MeshStandardMaterial).clone()
        if (mat.color) mat.color.lerp(tint, 0.18)
        if ('emissive' in mat) {
          mat.emissive = tint.clone()
          mat.emissiveIntensity = 0.22
        }
        return mat
      })
    })
    return root
  }, [scene, creature.id, creature.scale, creature.eyeColor])

  const { actions, mixer } = useAnimations(animations, group)

  // Resolve an intent to a concrete action present on this model.
  const actionFor = useMemo(() => {
    const names = Object.keys(actions)
    const find = (prefs: string[]) =>
      prefs.map((p) => names.find((n) => n.endsWith('|' + p) || n === p)).find(Boolean) ?? names[0]
    return (intent: Intent) => actions[find(INTENT_CLIPS[intent])!] ?? null
  }, [actions])

  // Play idle on load / creature change, and whenever a one-shot finishes.
  useEffect(() => {
    const idle = actionFor('idle')
    idle?.reset().fadeIn(0.3).play()

    const onFinished = () => {
      const back = actionFor('idle')
      back?.reset().fadeIn(0.25).play()
    }
    mixer.addEventListener('finished', onFinished)
    return () => {
      mixer.removeEventListener('finished', onFinished)
      mixer.stopAllAction()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creature.id, actionFor])

  // React to game pulses with a matching one-shot animation.
  const lastFx = useRef(0)
  useEffect(() => {
    if (!fx || fx.id === lastFx.current) return
    lastFx.current = fx.id
    const intent = FX_INTENT[fx.type]
    if (!intent) return
    const action = actionFor(intent)
    if (!action) return
    const idle = actionFor('idle')
    idle?.fadeOut(0.15)
    action.reset()
    action.setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true
    action.fadeIn(0.1).play()
  }, [fx, actionFor])

  // Idle quickens a touch while it "watches" you think.
  useEffect(() => {
    const idle = actionFor('idle')
    if (idle) idle.timeScale = thinking ? 1.35 : 1
  }, [thinking, actionFor])

  return (
    <group ref={group} rotation={[0, FACE_YAW, 0]} position={[0, GROUND_Y, 0]}>
      <primitive object={model} />
    </group>
  )
}
