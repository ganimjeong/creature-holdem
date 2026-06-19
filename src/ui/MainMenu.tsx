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
        Descend through a den of creature dealers, each with its own cruel edge
        and its own tell. Hoard <em>souls</em>, bind <em>charms</em>, spend blood
        on <em>rituals</em> &mdash; and break the Clockwork Maw at the bottom.
      </p>
      <button className="btn btn--ember" onClick={startRun}>
        Begin the Descent
      </button>
      <p className="menu__hint">Every edge has a counter. Nothing here is invincible — not even you.</p>
    </div>
  )
}
