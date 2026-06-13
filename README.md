# Creature Hold'em

> A dark, atmospheric **steampunk-horror Texas Hold'em**. You sit across a fog-drowned
> brass table from a creature dealer that watches from the black. Win the pot — or it
> keeps more than your chips. Lose all your lives and **you die.**

A 3D immersive web game built with **React Three Fiber**. The mood comes first:
near-black scene, a single ember light over the felt, glowing creature eyes, film grain,
bloom, and effects that erupt when a big hand hits or the pot swings.

![status](https://img.shields.io/badge/stage-vertical%20slice-orange)

## Concept

- **Roguelike survival run.** Heads-up (1v1) against the creature dealer, hand after hand.
- **Bust the dealer** → it returns hungrier, blinds climb, the run deepens.
- **Bust yourself** → lose a life. Run out of lives → the death screen.
- Atmosphere, tension, and juicy win/lose feedback over realism.

## Tech stack

| Layer | Choice |
| --- | --- |
| Build | Vite + React 19 + TypeScript |
| 3D | three.js, @react-three/fiber, @react-three/drei |
| Post-FX | @react-three/postprocessing (Bloom, Vignette, Noise, Chromatic Aberration) |
| State | zustand |
| Poker rules | `pokersolver` (hand evaluation) + a custom heads-up betting engine |

## Getting started

```bash
npm install        # if the npm cache complains about permissions:
                   #   npm install --cache /tmp/npm-cache
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
npm test           # engine unit tests (vitest)
```

> **macOS note:** if `npm install` fails with `EACCES` on `~/.npm`, either run
> `sudo chown -R $(id -u):$(id -g) ~/.npm` once, or install with
> `npm install --cache /tmp/npm-cache`.

## Project structure

```
src/
  game/
    engine/        pure, framework-free poker logic
      types.ts     cards, suits, ranks
      deck.ts      build + shuffle
      evaluate.ts  pokersolver wrapper (hand naming + comparison)
      holdem.ts    heads-up betting state machine (the heart of the rules)
      dealerAI.ts  the creature's decision-making
      engine.test.ts
    run/roguelike.ts   lives, blind schedule, round scaling
    store/gameStore.ts central zustand store — the contract the UI + scene read
  scene/           the 3D stage (three.js)
    layout.ts      shared world coordinates + THEME palette
    Scene.tsx      <Canvas> root
    Lighting / Atmosphere / Effects
    Table / Cards / Chips / CreatureDealer / FxRig
  ui/              HTML overlay
    ui.css         design system
    MainMenu / Hud / BettingControls / HandReveal / DeathScreen
public/assets/     drop CC0 art here (see its README) — slice runs without it
```

The clean split between `game/` (pure logic) and `scene/` + `ui/` (presentation,
both reading a single `gameStore`) keeps the rules testable and the visuals swappable.

## How a hand flows

1. `gameStore.startNextHand()` → `engine.startHand()` posts blinds and deals.
2. The player acts via `BettingControls` → `gameStore.playerAction()`.
3. The dealer acts on a dramatic timer via `dealerAI.decideDealerAction()`.
4. `holdem.ts` advances streets (flop/turn/river) and resolves the showdown with
   `evaluate.compareHands()`.
5. The result triggers an `fx` pulse → `FxRig` (3D bursts/shake) + `HandReveal` (UI).
6. `gameStore.continueRun()` applies roguelike transitions (round up / life lost / death).

## Roadmap (beyond the slice)

- Full multi-raise betting polish, side-pot edge cases, alternating button.
- Smarter dealer (bluff modeling, pot odds), run meta (curses/relics between rounds).
- Real CC0 creature model + rigged animation, PBR table textures, HDRI lighting.
- Sound design (boiler-room ambience, card flips, win/lose stingers).
- Mobile controls, web deploy (Vercel / itch.io).

## License

Code: MIT (or your choice). Bring only CC0 / properly-licensed assets into `public/assets/`.
