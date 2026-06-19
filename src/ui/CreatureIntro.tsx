import { useGame } from '../game/store/gameStore'

/** The card that introduces the creature you're about to face — its name, its
 *  edge, and (always) the tell that counters it. Knowledge is the only fair fight. */
export function CreatureIntro() {
  const creature = useGame((s) => s.creature)
  const beginEncounter = useGame((s) => s.beginEncounter)
  if (!creature) return null

  const tierLabel =
    creature.tier === 'boss' ? 'FINAL DEALER' : creature.tier === 'elite' ? 'ELITE' : 'DEALER'

  return (
    <div className="screen screen--intro">
      <div className="intro__card panel" style={{ '--eye': creature.eyeColor } as React.CSSProperties}>
        <p className="kicker intro__tier">{tierLabel}</p>
        <h2 className="intro__name">{creature.name}</h2>
        <p className="intro__title">{creature.title}</p>
        <p className="intro__flavor">{creature.flavor}</p>

        <div className="intro__tell">
          <span className="intro__tell-label">ITS TELL</span>
          <p>{creature.tell}</p>
        </div>

        <button className="btn btn--ember" onClick={() => beginEncounter()}>
          Sit Down
        </button>
      </div>
    </div>
  )
}
