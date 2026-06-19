# Creature Hold'em

> A dark, atmospheric **steampunk-horror Texas Hold'em**. You sit across a fog-drowned
> brass table from a creature dealer that watches from the black. Win the pot — or it
> keeps more than your chips. Lose all your lives and **you die.**

A 3D immersive web game built with **React Three Fiber**. The mood comes first:
near-black scene, a single ember light over the felt, glowing creature eyes, film grain,
bloom, and effects that erupt when a big hand hits or the pot swings.

![status](https://img.shields.io/badge/stage-vertical%20slice-orange)

## Concept

A roguelike **descent** through a den of creature dealers — Inscryption's rule-bending
dealer, Slay the Spire's branching map + relics, Balatro's legible build modifiers.

- **The descent.** A branching map of nodes: dealers, elites, shops, events, rests, and a
  final boss (the Clockwork Maw). Pick your path down.
- **Diverse creatures.** Each dealer is built around one memorable edge — a bluffer, a
  hoarder that never lies, a watcher that reads a card, a pot-taxing glutton, a mirror,
  a soul-leech, a river-cheating jester. **Every edge has a telegraphed counter (its
  *tell*) — nothing on this felt is invincible.**
- **Charms** (passive relics), **Rituals** (active, soul-fuelled abilities), and **Souls**
  (the currency) give the run build variety and tactical depth. Every charm/ritual carries
  an honest cost or a creature that counters it.
- **Lives.** Bust out of a duel → lose a life and re-sit. Out of lives → you die.
  Break the boss → you win.

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
    content/         the roguelike data (declarative — easy to balance)
      creatures.ts   the bestiary: each creature's edge, tell, AI profile
      charms.ts      passive relics (each with a built-in downside/counter)
      rituals.ts     active, soul-fuelled abilities
      events.ts      non-combat map nodes (risk/reward choices)
    run/
      roguelike.ts   lives, blind schedule, run economy constants
      map.ts         the branching descent (pure, seedable)
      modifiers.ts   THE effect layer — applies every charm/creature/ritual edge
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

## Design rule: no invincibility

Every advantage is paired with a counter, so no build (or creature) is unbeatable:

- **Creatures** telegraph a weakness — the Gambler over-bluffs (call it down), the
  Hoarder never bluffs (steal its pots), the Watcher sees one card (bluff the other or
  Veil it), the Jester cheats only the river (win it by the turn).
- **Charms** carry honest costs — Gambler's Heart buys a life but starts you poorer;
  Vein Tap drains the creature on a win but drains *you* on a loss; Widow's Veil cuts
  both ways.
- **Rituals** all spend scarce **souls**, so the economy itself caps them; several add a
  once-per-hand limit or simply miss (Hex does nothing to a strong hand).

The poker **engine stays pure**; the entire roguelike layer is applied in `run/modifiers.ts`
and orchestrated by the store, so the rules stay testable and the meta-game lives in one place.

## Roadmap (beyond the slice)

- Per-card dealer reveals for the Veil; charm/ritual upgrade tiers; relic synergies.
- Real CC0 creature models per dealer, rigged animation, PBR table textures.
- Sound design (boiler-room ambience, card flips, ritual stingers).
- Mobile controls, web deploy (Vercel / itch.io).

## License

Code: MIT (or your choice). Bring only CC0 / properly-licensed assets into `public/assets/`.
