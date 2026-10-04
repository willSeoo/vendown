import { useState } from 'react'
import Thumb from '../../components/Thumb'
import { useConfirm } from '../../hooks/useConfirm'
import { per, profitEach, shown, wl } from '../../lib/money'
import { catOf } from '../../lib/names'
import { useShop } from '../../store/ShopContext'
import type { Item } from '../../types'

type Props = {
  item: Item
  open: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: (id: number) => void
}

/** One stock item: collapsed to picture + name, tap to reveal prices, profit and actions. */
export default function ItemCard({ item: i, open: isOpen, onToggle, onEdit, onDelete }: Props) {
  const { sellItem } = useShop()
  const [soldQty, setSoldQty] = useState('1')
  const { armed, ask } = useConfirm()
  const sell = () => sellItem(i, Math.min(i.qty, Math.max(1, parseInt(soldQty || '1', 10) || 1)))
  const pe = profitEach(i)
  const mkt = i.mp === undefined ? null : per(i.mp, i.mm ?? 'each')
  const md = mkt && mkt > 0 ? Math.round((per(i.pr, i.pm) / mkt - 1) * 100) : null
  const margin = i.cr > 0 ? Math.round((pe / per(i.cr, i.cm)) * 100) : null
  return (
    <div className={`item${i.qty === 0 ? ' out' : ''}${isOpen ? ' open' : ''}`}>
      <button className="ihead" aria-expanded={isOpen} onClick={onToggle}>
        <Thumb name={i.name} />
        <span className="itxt">
          <b>{i.name}</b>
          <span><small className="tag">{catOf(i)}</small>{i.qty === 0 && <small className="tag">Sold out</small>}</span>
        </span>
        <span className="chev" aria-hidden="true">▾</span>
      </button>
      {isOpen && (
        <div className="ibody">
          {i.note && <div className="inote">{i.note}</div>}
          <div className="c"><small>Modal</small><b>{shown(i.cr, i.cm)}</b></div>
          <div className="c sell">
            <small>Sell</small><b>{shown(i.pr, i.pm)}</b>
            {i.mp !== undefined && (
              <small>Market: {shown(i.mp, i.mm ?? 'each')}{i.mt ? ` (${new Date(i.mt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})` : ''}</small>
            )}
            {md !== null && <small>{md === 0 ? 'Equal to market' : `${Math.abs(md)}% ${md > 0 ? 'above' : 'below'} market`}</small>}
          </div>
          <div className="c">
            <small>Profit (all stock)</small>
            <b className={pe >= 0 ? 'up' : 'down'}>{pe >= 0 ? '+' : ''}{wl(pe * i.qty)}</b>
            {margin !== null && <small>{margin}% margin</small>}
          </div>
          <div className="c"><small>Stock</small><b>{i.qty}{i.qty === 0 ? ' (sold out)' : ''}</b></div>
          <div className="act">
            <input className="sq" type="number" min="1" max={i.qty} value={soldQty} disabled={i.qty === 0}
              onChange={(e) => setSoldQty(e.target.value)} aria-label="Quantity sold" />
            <button className="sm" disabled={i.qty === 0} onClick={sell}>Sold</button>
            <button className="sm" onClick={onEdit}>Edit</button>
            <button className="sm del" onClick={() => ask('del', () => onDelete(i.id))}>{armed === 'del' ? 'Confirm delete' : 'Delete'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
