import { useGame } from '../game/store/gameStore'
import { nodeIcon, MapNode } from '../game/run/map'
import { MAP_DEPTH } from '../game/run/map'

const NODE_HINT: Record<MapNode['type'], string> = {
  dealer: 'A dealer waits. Bust it to descend.',
  elite: 'A stronger creature — richer spoils.',
  shop: 'Trade souls for charms and rituals.',
  event: 'An unknown door. Risk and reward.',
  rest: 'Mend a life, or scavenge for souls.',
  boss: 'The end of the descent.',
}

export function RunMap() {
  const map = useGame((s) => s.map)
  const mapColumn = useGame((s) => s.mapColumn)
  const chooseNode = useGame((s) => s.chooseNode)
  const souls = useGame((s) => s.souls)

  if (!map) return null
  const col = map.columns[mapColumn] ?? []
  const isBoss = mapColumn >= MAP_DEPTH

  return (
    <div className="screen screen--map">
      <div className="screen__head">
        <p className="kicker">The Descent — Depth {mapColumn + 1} / {MAP_DEPTH + 1}</p>
        <h2 className="screen__title">{isBoss ? 'The Bottom of the Dark' : 'Choose Your Path'}</h2>
        <div className="screen__souls">◈ {souls} souls</div>
      </div>

      <div className="nodecards">
        {col.map((node, i) => (
          <button
            key={i}
            className={`nodecard nodecard--${node.type}`}
            onClick={() => chooseNode(i)}
          >
            <div className="nodecard__icon">{nodeIcon(node.type)}</div>
            <div className="nodecard__label">{node.label}</div>
            <div className="nodecard__sub">{node.sub}</div>
            <div className="nodecard__hint">{NODE_HINT[node.type]}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
