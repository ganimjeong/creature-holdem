import { useGame } from '../game/store/gameStore'

export function VictoryScreen() {
  const handsPlayed = useGame((s) => s.handsPlayed)
  const souls = useGame((s) => s.souls)
  const ownedCharms = useGame((s) => s.ownedCharms)
  const startRun = useGame((s) => s.startRun)
  const backToMenu = useGame((s) => s.backToMenu)

  return (
    <div className="victory">
      <h1 className="victory__title">YOU SURVIVED</h1>
      <p className="victory__sub">The Clockwork Maw lies still. The gears go quiet.</p>
      <div className="victory__stats">
        You broke the descent across {handsPlayed} hands,
        <br />
        carrying {ownedCharms.length} charms and {souls} souls into the light.
      </div>
      <div className="betbar__row">
        <button className="btn btn--ember" onClick={() => startRun()}>
          Descend Again
        </button>
        <button className="btn" onClick={() => backToMenu()}>
          Rest at Last
        </button>
      </div>
    </div>
  )
}
