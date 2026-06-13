import { useGame } from '../game/store/gameStore'

export function MainMenu() {
  const startRun = useGame((s) => s.startRun)

  return (
    <div className="menu">
      <p className="kicker">A Game of Chance &amp; Hunger</p>
      <h1 className="menu__title">
        CREATURE <em>HOLD&rsquo;EM</em>
      </h1>
      <p className="menu__tagline">
        Across the felt, something with too many eyes is dealing. Win the
        pot &mdash; or it keeps more than your chips.
      </p>
      <p className="menu__tagline">
        Heads-up Texas Hold&rsquo;em. Bust the creature to climb a round; bust
        out and it feeds.
      </p>
      <button className="btn btn--ember" onClick={startRun}>
        Sit at the Table
      </button>
      <p className="menu__hint">Lose all three lives and you die.</p>
    </div>
  )
}
