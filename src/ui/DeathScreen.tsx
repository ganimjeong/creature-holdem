import { useGame } from '../game/store/gameStore'
import { roundTitle } from '../game/run/roguelike'

export function DeathScreen() {
  const round = useGame((s) => s.round)
  const handsPlayed = useGame((s) => s.handsPlayed)
  const startRun = useGame((s) => s.startRun)
  const backToMenu = useGame((s) => s.backToMenu)

  // round is 0-indexed; the player cleared `round` rounds before busting.
  const roundsSurvived = round
  const roundWord = roundsSurvived === 1 ? 'round' : 'rounds'
  const handWord = handsPlayed === 1 ? 'hand' : 'hands'

  return (
    <div className="death">
      <h1 className="death__title">YOU DIED</h1>
      <p className="death__sub">The creature collects its debt</p>
      <div className="death__stats">
        You survived {roundsSurvived} {roundWord} across {handsPlayed} {handWord}.
        <br />
        It is sharpening its gears for <em>{roundTitle(round)}</em>.
      </div>
      <div className="betbar__row">
        <button className="btn btn--ember" onClick={() => startRun()}>
          Try Again
        </button>
        <button className="btn" onClick={() => backToMenu()}>
          Return to the Dark
        </button>
      </div>
    </div>
  )
}
