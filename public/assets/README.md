# Assets

The vertical slice renders everything **procedurally** (geometry + shaders + text),
so no binary assets are required to run. This folder is where you drop CC0 art when
you want to upgrade the look. Nothing here is committed by default.

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
