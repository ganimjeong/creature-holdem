import { useState } from 'react'
import { useGame } from '../game/store/gameStore'
import { getRitual } from '../game/content/rituals'
import { ritualUsable } from '../game/run/modifiers'

/** The ritual rail — your owned active abilities, each spending scarce souls.
 *  Sits above the betting bar and only lights a ritual when it's legal AND
 *  affordable, so the souls economy is the natural brake on spamming them. */
export function RitualBar() {
  const ownedRituals = useGame((s) => s.ownedRituals)
  const souls = useGame((s) => s.souls)
  const hand = useGame((s) => s.hand)
  const usedThisHand = useGame((s) => s.ritualsUsedThisHand)
  const useRitual = useGame((s) => s.useRitual)
  const [searTarget, setSearTarget] = useState(false)

  if (ownedRituals.length === 0) return null
  // Only meaningful on the player's live turn.
  if (!hand || hand.toAct !== 'player' || hand.street === 'complete' || hand.street === 'showdown') {
    return null
  }

  return (
    <div className="ritualbar">
      <div className="ritualbar__label">RITUALS · ◈ {souls}</div>
      <div className="ritualbar__row">
        {ownedRituals.map((id) => {
          const ritual = getRitual(id)
          const used = usedThisHand.includes(id)
          const legal = ritualUsable(ritual.kind, hand)
          const afford = souls >= ritual.cost
          const disabled = used || !legal || !afford

          if (ritual.kind === 'sear' && searTarget && !disabled) {
            return (
              <div key={id} className="ritualbtn ritualbtn--targeting">
                <span className="ritualbtn__name">Burn which?</span>
                <div className="ritualbtn__targets">
                  <button className="btn btn--ember" onClick={() => { useRitual(id, 0); setSearTarget(false) }}>1st</button>
                  <button className="btn btn--ember" onClick={() => { useRitual(id, 1); setSearTarget(false) }}>2nd</button>
                  <button className="btn" onClick={() => setSearTarget(false)}>✕</button>
                </div>
              </div>
            )
          }

          return (
            <button
              key={id}
              className="ritualbtn"
              disabled={disabled}
              title={`${ritual.flavor}\n\n${ritual.limitation}`}
              onClick={() => {
                if (ritual.needsTarget) setSearTarget(true)
                else useRitual(id)
              }}
            >
              <span className="ritualbtn__name">{ritual.name}</span>
              <span className="ritualbtn__cost">◈ {ritual.cost}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
