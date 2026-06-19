import { useGame } from '../game/store/gameStore'
import { getCharm } from '../game/content/charms'

/** After busting a creature: pick one charm spoil (or skip). Every charm shows
 *  its honest downside, so the choice is a real trade, not a freebie. */
export function RewardScreen() {
  const rewardCharms = useGame((s) => s.rewardCharms)
  const takeReward = useGame((s) => s.takeReward)

  return (
    <div className="screen screen--reward">
      <div className="screen__head">
        <p className="kicker">Spoils of the Broken</p>
        <h2 className="screen__title">Take One Charm</h2>
      </div>

      <div className="charmcards">
        {rewardCharms.map((id) => {
          const charm = getCharm(id)
          return (
            <button key={id} className={`charmcard charmcard--${charm.rarity}`} onClick={() => takeReward(id)}>
              <div className="charmcard__rarity">{charm.rarity}</div>
              <div className="charmcard__name">{charm.name}</div>
              <p className="charmcard__flavor">{charm.flavor}</p>
              <div className="charmcard__downside">⚠ {charm.downside}</div>
            </button>
          )
        })}
      </div>

      <button className="btn charmcards__skip" onClick={() => takeReward(null)}>
        Take nothing, descend
      </button>
    </div>
  )
}
