import { useGame } from '../game/store/gameStore'
import { roundTitle, STARTING_LIVES } from '../game/run/roguelike'

/** A small, ominous inline heart — a life remaining at the table. */
function Heart({ lost }: { lost: boolean }) {
  return (
    <svg
      className={lost ? 'heart heart--lost' : 'heart'}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 21s-7.5-4.6-10-9.2C.6 9 1.4 5.6 4.2 4.4 6.4 3.5 9 4.2 10.4 6c.6.8.9 1.3 1.6 2 .7-.7 1-1.2 1.6-2 1.4-1.8 4-2.5 6.2-1.6 2.8 1.2 3.6 4.6 2.2 7.4C19.5 16.4 12 21 12 21z"
        style={{ color: '#e0301f' }}
      />
    </svg>
  )
}

export function Hud() {
  const hand = useGame((s) => s.hand)
  const lives = useGame((s) => s.lives)
  const round = useGame((s) => s.round)
  const isDealerThinking = useGame((s) => s.isDealerThinking)
  const message = useGame((s) => s.message)

  if (!hand) return null

  return (
    <div className="hud">
      <div className="hud__top">
        <div className="hud__lives">
          {Array.from({ length: STARTING_LIVES }, (_, i) => (
            <Heart key={i} lost={i >= lives} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="stat panel">
            <div className="stat__label">Your Stack</div>
            <div className="stat__value">{hand.player.chips.toLocaleString()}</div>
          </div>
          <div className="stat panel">
            <div className="stat__label">Creature</div>
            <div className="stat__value">{hand.dealer.chips.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="hud__round">
        <div className="kicker">{roundTitle(round)}</div>
        <div className="stat__label">
          Blinds {hand.smallBlind.toLocaleString()}/{hand.bigBlind.toLocaleString()}
        </div>
      </div>

      <div className="hud__pot">
        <div className="stat__label">Pot</div>
        <div className="stat__value">{hand.pot.toLocaleString()}</div>
      </div>

      {isDealerThinking && (
        <div className="hud__dealer-tag thinking">THE CREATURE IS WATCHING…</div>
      )}

      {message && <div className="hud__message">{message}</div>}
    </div>
  )
}
