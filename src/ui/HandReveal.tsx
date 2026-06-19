import { useGame } from '../game/store/gameStore'

const VERDICT: Record<
  'player' | 'dealer' | 'split',
  { mod: string; text: string }
> = {
  player: { mod: 'reveal__verdict--win', text: 'YOU WIN' },
  dealer: { mod: 'reveal__verdict--lose', text: 'THE CREATURE WINS' },
  split: { mod: 'reveal__verdict--split', text: 'SPLIT POT' },
}

export function HandReveal() {
  const hand = useGame((s) => s.hand)
  const lastResult = useGame((s) => s.lastResult)
  const effectMessages = useGame((s) => s.effectMessages)
  const continueRun = useGame((s) => s.continueRun)

  if (!hand || hand.street !== 'complete' || !lastResult) return null

  const verdict = VERDICT[lastResult.winner]
  const isShowdown = lastResult.reason === 'showdown'

  // Beating the creature this hand ends the encounter — phrase the button for it.
  const bustsDealer = hand.dealer.chips <= 0
  const bustsPlayer = hand.player.chips <= 0
  const cta = bustsDealer ? 'CLAIM THE SPOILS' : bustsPlayer ? 'BACK TO THE TABLE' : 'CONTINUE'

  return (
    <div className="reveal">
      <div className={`reveal__verdict ${verdict.mod}`}>{verdict.text}</div>

      {isShowdown && (
        <div className="reveal__hands">
          <span>
            You: <b>{lastResult.playerHandName}</b>
          </span>
          <span>
            Creature: <b>{lastResult.dealerHandName}</b>
          </span>
        </div>
      )}

      {effectMessages.length > 0 && (
        <div className="reveal__effects">
          {effectMessages.map((m, i) => (
            <div key={i} className="reveal__effect">{m}</div>
          ))}
        </div>
      )}

      <button className="btn btn--ember" onClick={() => continueRun()}>
        {cta}
      </button>
    </div>
  )
}
