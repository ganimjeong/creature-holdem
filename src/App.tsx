import { Scene } from './scene/Scene'
import { useGame } from './game/store/gameStore'
import { MainMenu } from './ui/MainMenu'
import { Hud } from './ui/Hud'
import { BettingControls } from './ui/BettingControls'
import { RitualBar } from './ui/RitualBar'
import { HandReveal } from './ui/HandReveal'
import { DeathScreen } from './ui/DeathScreen'
import { RunMap } from './ui/RunMap'
import { CreatureIntro } from './ui/CreatureIntro'
import { RewardScreen } from './ui/RewardScreen'
import { Shop } from './ui/Shop'
import { EventScreen } from './ui/EventScreen'
import { RestScreen } from './ui/RestScreen'
import { VictoryScreen } from './ui/VictoryScreen'

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
        {phase === 'map' && <RunMap />}
        {phase === 'intro' && <CreatureIntro />}

        {phase === 'playing' && (
          <>
            <Hud />
            <HandReveal />
            <RitualBar />
            <BettingControls />
          </>
        )}

        {phase === 'reward' && <RewardScreen />}
        {phase === 'shop' && <Shop />}
        {phase === 'event' && <EventScreen />}
        {phase === 'rest' && <RestScreen />}
        {phase === 'gameover' && <DeathScreen />}
        {phase === 'victory' && <VictoryScreen />}
      </div>
    </div>
  )
}
