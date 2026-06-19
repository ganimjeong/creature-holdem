import { useGame } from '../game/store/gameStore'
import { getCharm } from '../game/content/charms'
import { getRitual } from '../game/content/rituals'

/** The Pawnbroker — spend souls on charms, rituals, or mending a lost life. */
export function Shop() {
  const shopItems = useGame((s) => s.shopItems)
  const souls = useGame((s) => s.souls)
  const buyShopItem = useGame((s) => s.buyShopItem)
  const leaveShop = useGame((s) => s.leaveShop)

  return (
    <div className="screen screen--shop">
      <div className="screen__head">
        <p className="kicker">The Pawnbroker</p>
        <h2 className="screen__title">Trade in Souls</h2>
        <div className="screen__souls">◈ {souls} souls</div>
      </div>

      <div className="shopgrid">
        {shopItems.map((item, i) => {
          const charm = item.kind === 'charm' && item.id ? getCharm(item.id) : null
          const ritual = item.kind === 'ritual' && item.id ? getRitual(item.id) : null
          const afford = souls >= item.cost && !item.sold
          const title = charm?.name ?? ritual?.name ?? 'Mend a Life'
          const tag = item.kind === 'charm' ? 'CHARM' : item.kind === 'ritual' ? 'RITUAL' : 'SERVICE'
          const body = charm
            ? charm.flavor
            : ritual
              ? ritual.flavor
              : 'Restore one lost heart at the table.'
          const downside = charm ? charm.downside : ritual ? ritual.limitation : null

          return (
            <div key={i} className={`shopitem shopitem--${item.kind} ${item.sold ? 'shopitem--sold' : ''}`}>
              <div className="shopitem__tag">{tag}</div>
              <div className="shopitem__name">{title}</div>
              <p className="shopitem__body">{body}</p>
              {downside && <div className="shopitem__downside">⚠ {downside}</div>}
              <button className="btn btn--ember shopitem__buy" disabled={!afford} onClick={() => buyShopItem(i)}>
                {item.sold ? 'Sold' : `◈ ${item.cost}`}
              </button>
            </div>
          )
        })}
      </div>

      <button className="btn" onClick={() => leaveShop()}>
        Leave the Pawnbroker
      </button>
    </div>
  )
}
