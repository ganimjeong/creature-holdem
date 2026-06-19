import { useGame } from '../game/store/gameStore'

export function EventScreen() {
  const event = useGame((s) => s.event)
  const souls = useGame((s) => s.souls)
  const resultText = useGame((s) => s.eventResultText)
  const resolveEvent = useGame((s) => s.resolveEvent)
  const dismissEvent = useGame((s) => s.dismissEvent)
  if (!event) return null

  return (
    <div className="screen screen--event">
      <div className="event__card panel">
        <p className="kicker">An Unknown Door</p>
        <h2 className="event__name">{event.name}</h2>
        <p className="event__flavor">{event.flavor}</p>

        {resultText ? (
          <>
            <p className="event__result">{resultText}</p>
            <button className="btn btn--ember" onClick={() => dismissEvent()}>
              Move On
            </button>
          </>
        ) : (
          <div className="event__options">
            {event.options.map((opt, i) => {
              const cantAfford = opt.costSouls !== undefined && souls < opt.costSouls
              const cost: string[] = []
              if (opt.costSouls) cost.push(`◈ ${opt.costSouls}`)
              if (opt.costChips) cost.push(`${opt.costChips} chips`)
              if (opt.chance !== undefined) cost.push(`${Math.round(opt.chance * 100)}% odds`)
              return (
                <button
                  key={i}
                  className="btn event__option"
                  disabled={cantAfford}
                  onClick={() => resolveEvent(i)}
                >
                  <span>{opt.label}</span>
                  {cost.length > 0 && <span className="event__cost">{cost.join(' · ')}</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
