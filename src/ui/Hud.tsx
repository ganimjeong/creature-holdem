import { useGame } from '../game/store/gameStore'
import { getCharm } from '../game/content/charms'
import { Card, SUIT_SYMBOL } from '../game/engine/types'

const cardText = (c: Card) => `${c.rank === 'T' ? '10' : c.rank}${SUIT_SYMBOL[c.suit]}`

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
  const maxLives = useGame((s) => s.maxLives())
  const souls = useGame((s) => s.souls)
  const creature = useGame((s) => s.creature)
  const ownedCharms = useGame((s) => s.ownedCharms)
  const isDealerThinking = useGame((s) => s.isDealerThinking)
  const message = useGame((s) => s.message)
  const creatureSeesPlayer = useGame((s) => s.creatureSeesPlayer)
  const playerSeesDealer = useGame((s) => s.playerSeesDealer)

  if (!hand) return null

  return (
    <div className="hud">
      <div className="hud__top">
        <div className="hud__topleft">
          <div className="hud__lives">
            {Array.from({ length: maxLives }, (_, i) => (
              <Heart key={i} lost={i >= lives} />
            ))}
          </div>
          <div className="hud__souls">◈ {souls}</div>
          {ownedCharms.length > 0 && (
            <div className="hud__charms">
              {ownedCharms.map((id) => {
                const charm = getCharm(id)
                return (
                  <span
                    key={id}
                    className={`charmchip charmchip--${charm.rarity}`}
                    title={`${charm.name} — ${charm.flavor}\n⚠ ${charm.downside}`}
                  >
                    {charm.name}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div className="stat panel">
            <div className="stat__label">Your Stack</div>
            <div className="stat__value">{hand.player.chips.toLocaleString()}</div>
          </div>
          <div className="stat panel">
            <div className="stat__label">{creature?.name ?? 'Creature'}</div>
            <div className="stat__value">{hand.dealer.chips.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="hud__round">
        {creature && (
          <div className="kicker" style={{ color: creature.eyeColor }}>
            {creature.name} · {creature.title}
          </div>
        )}
        <div className="stat__label">
          Blinds {hand.smallBlind.toLocaleString()}/{hand.bigBlind.toLocaleString()}
        </div>
        {creature && <div className="hud__tell">⌖ {creature.tell}</div>}
      </div>

      <div className="hud__pot">
        <div className="stat__label">Pot</div>
        <div className="stat__value">{hand.pot.toLocaleString()}</div>
      </div>

      {creatureSeesPlayer !== null && (
        <div className="hud__warn hud__warn--bad">⚠ It has read your {creatureSeesPlayer === 0 ? 'first' : 'second'} card</div>
      )}
      {playerSeesDealer !== null && hand.dealer.hole[playerSeesDealer] && (
        <div className="hud__warn hud__warn--good">
          ◉ The veil shows its card: {cardText(hand.dealer.hole[playerSeesDealer])}
        </div>
      )}

      {isDealerThinking && (
        <div className="hud__dealer-tag thinking">{(creature?.name ?? 'THE CREATURE').toUpperCase()} IS WATCHING…</div>
      )}

      {message && <div className="hud__message">{message}</div>}
    </div>
  )
}
