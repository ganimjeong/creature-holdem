import { useEffect, useState } from 'react'
import { useGame } from '../game/store/gameStore'

export function BettingControls() {
  const hand = useGame(s => s.hand)
  const isDealerThinking = useGame(s => s.isDealerThinking)
  const playerAction = useGame(s => s.playerAction)
  const legalActions = useGame(s => s.legalActions)

  const legal = legalActions('player')
  const minRaiseTo = legal?.minRaiseTo ?? 0
  const maxRaiseTo = legal?.maxRaiseTo ?? 0

  const [raiseTo, setRaiseTo] = useState(minRaiseTo)

  // Re-clamp the slider whenever the legal raise window shifts (e.g. new street).
  useEffect(() => {
    setRaiseTo(prev => {
      const clamped = Math.min(Math.max(prev, minRaiseTo), maxRaiseTo)
      return Number.isFinite(clamped) ? clamped : minRaiseTo
    })
  }, [minRaiseTo, maxRaiseTo])

  // Only render on the player's live turn.
  if (
    !hand ||
    hand.toAct !== 'player' ||
    hand.street === 'complete' ||
    hand.street === 'showdown'
  ) {
    return null
  }
  if (!legal) return null

  const busy = isDealerThinking
  const safeRaiseTo = Math.min(Math.max(raiseTo, minRaiseTo), maxRaiseTo)

  return (
    <div className="betbar">
      {legal.canRaise && (
        <div className="betbar__slider panel">
          <input
            type="range"
            min={legal.minRaiseTo}
            max={legal.maxRaiseTo}
            value={safeRaiseTo}
            disabled={busy}
            onChange={e => setRaiseTo(Number(e.target.value))}
          />
          <div className="betbar__amount">{safeRaiseTo.toLocaleString()}</div>
        </div>
      )}

      <div className="betbar__row">
        <button
          className="btn btn--danger"
          disabled={busy || !legal.canFold}
          onClick={() => playerAction('fold')}
        >
          Fold
        </button>

        {legal.canCheck && (
          <button
            className="btn"
            disabled={busy}
            onClick={() => playerAction('check')}
          >
            Check
          </button>
        )}

        {legal.canCall && (
          <button
            className="btn"
            disabled={busy}
            onClick={() => playerAction('call')}
          >
            Call {legal.callAmount.toLocaleString()}
          </button>
        )}

        <button
          className="btn btn--ember"
          disabled={busy || !legal.canRaise}
          onClick={() => playerAction('raise', safeRaiseTo)}
        >
          Raise to {safeRaiseTo.toLocaleString()}
        </button>

        <button
          className="btn"
          disabled={busy}
          onClick={() => playerAction('allin')}
        >
          All-in
        </button>
      </div>
    </div>
  )
}
