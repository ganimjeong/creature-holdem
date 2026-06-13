# Assets

Most of the game renders **procedurally** (geometry + shaders + text). The one
bundled binary asset is the background environment.

## Bundled (all CC0 / public domain, from [Poly Haven](https://polyhaven.com))

| File | Source | Used by |
| --- | --- | --- |
| `hdri/hayloft_2k.hdr` | [Hayloft](https://polyhaven.com/a/hayloft) | `Scene.tsx` — image-based fill light |
| `models/Lantern_01/` | [Lantern 01](https://polyhaven.com/a/Lantern_01) | `CabinProps.tsx` — lantern on the table |
| `models/CheeseBox_01/` | [Cheese Box 01](https://polyhaven.com/a/CheeseBox_01) | `CabinProps.tsx` — stacked crates |
| `models/Rockingchair_01/` | [Rocking Chair 01](https://polyhaven.com/a/Rockingchair_01) | `CabinProps.tsx` — corner chair |
| `models/Shelf_01/` | [Shelf 01](https://polyhaven.com/a/Shelf_01) | `CabinProps.tsx` — wall shelf |
| `textures/beam_wall_01/` | [Beam Wall 01](https://polyhaven.com/a/beam_wall_01) | `CabinRoom.tsx` — cabin walls |
| `textures/brown_planks_05/` | [Brown Planks 05](https://polyhaven.com/a/brown_planks_05) | `CabinRoom.tsx` — floor + ceiling |

Models are Poly Haven glTF (1k) with their textures + `.bin` mirrored locally so
the game runs offline. The room itself (`CabinRoom.tsx`) is procedural geometry
clad in the plank/beam textures; props (`CabinProps.tsx`) auto-scale to a target
height via their bounding box, so swapping a model "just works" regardless of its
native scale. CC0 needs no attribution, but Poly Haven is credited here anyway.

## Recommended CC0 / free sources (license-safe)

| Need | Source | Notes |
| --- | --- | --- |
| Creature dealer model (.glb) | [Quaternius](https://quaternius.com/), [Poly Pizza](https://poly.pizza/), [Sketchfab — CC0 filter](https://sketchfab.com/search?features=downloadable&licenses=cc0) | Look for a hooded/monstrous bust; load with drei `useGLTF` and swap into `CreatureDealer.tsx`. |
| Felt / brass / wood textures | [Poly Haven](https://polyhaven.com/textures), [ambientCG](https://ambientcg.com/) | PBR sets (albedo/normal/roughness) for the table. |
| Environment / lighting HDRI | [Poly Haven HDRIs](https://polyhaven.com/hdris) | Pick a dark interior / candle-lit one; use drei `<Environment>`. |
| Card faces / UI / SFX | [Kenney.nl](https://kenney.nl/assets) | CC0 card decks and sound effects. |
| Ambience & stingers (audio) | [Freesound (CC0 filter)](https://freesound.org/), [Kenney](https://kenney.nl/assets?q=audio) | Boiler-room hum, card flips, win/lose stingers. |

## Suggested layout
```
public/assets/
  models/      creature.glb, props/*.glb
  textures/    felt_*.jpg, brass_*.jpg
  hdri/        dark_interior.hdr
  cards/       (optional face atlas)
  audio/       ambience.ogg, deal.ogg, win.ogg, lose.ogg
```

## How to wire an asset in
- Models: `const { scene } = useGLTF('/assets/models/creature.glb')` inside `CreatureDealer.tsx`.
- HDRI: `<Environment files="/assets/hdri/dark_interior.hdr" />` in `Scene.tsx`.
- Audio: drei `<PositionalAudio url="/assets/audio/deal.ogg" />`, triggered off store `fx` pulses.

Always confirm each asset's license is CC0 (or otherwise permits redistribution) before committing it.
