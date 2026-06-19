import { useGame } from '../game/store/gameStore'
import { REST_SCAVENGE_SOULS } from '../game/run/roguelike'

export function RestScreen() {
  const resolveRest = useGame((s) => s.resolveRest)
  const lives = useGame((s) => s.lives)
  const maxLives = useGame((s) => s.maxLives())
  const canMend = lives < maxLives

  return (
    <div className="screen screen--rest">
      <div className="event__card panel">
        <p className="kicker">A Cold Hearth</p>
        <h2 className="event__name">A Moment's Respite</h2>
        <p className="event__flavor">
          The fire has long gone out, but the dark here is almost gentle. You have a single moment — spend it.
        </p>
        <div className="event__options">
          <button className="btn event__option" disabled={!canMend} onClick={() => resolveRest('mend')}>
            <span>Mend a wound</span>
            <span className="event__cost">{canMend ? '+1 life' : 'already whole'}</span>
          </button>
          <button className="btn event__option" onClick={() => resolveRest('scavenge')}>
            <span>Scavenge the ashes</span>
            <span className="event__cost">+{REST_SCAVENGE_SOULS} souls</span>
          </button>
        </div>
      </div>
    </div>
  )
}
