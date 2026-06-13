import { Scene } from './scene/Scene'
import { useGame } from './game/store/gameStore'
import { MainMenu } from './ui/MainMenu'
import { Hud } from './ui/Hud'
import { BettingControls } from './ui/BettingControls'
import { HandReveal } from './ui/HandReveal'
import { DeathScreen } from './ui/DeathScreen'

/**
 * Root layout: a full-screen 3D scene with the HTML game UI overlaid on top.
 * Which UI shows is driven entirely by the store's run phase.
 */
export function App() {
  const phase = useGame((s) => s.phase)

  return (
    <div className="app-root">
      <Scene />

      <div className="ui-layer">
        {phase === 'menu' && <MainMenu />}

        {phase === 'playing' && (
          <>
            <Hud />
            <HandReveal />
            <BettingControls />
          </>
        )}

        {phase === 'gameover' && <DeathScreen />}
      </div>
    </div>
  )
}
