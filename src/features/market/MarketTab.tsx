import { useState } from 'react'
import type { FormEvent } from 'react'
import NameSuggest from '../../components/NameSuggest'
import Thumb from '../../components/Thumb'
import { CATS } from '../../constants'
import { useConfirm } from '../../hooks/useConfirm'
import { dlabel, today } from '../../lib/dates'
import { per, shown } from '../../lib/money'
import { useShop } from '../../store/ShopContext'
import type { MEntry, MItem, MarketEdit, Mode } from '../../types'

export default function MarketTab() {
  const { market, saveMarketEntry, deleteMarketEntry, deleteMarketItem } = useShop()
  const [mForm, setMForm] = useState({ name: '', cat: 'Block', price: '', mode: 'each', date: today(), note: '' })
  const [mEdit, setMEdit] = useState<MarketEdit | null>(null)
  const [mq, setMq] = useState('')
  const [open, setOpen] = useState(false)
  const { armed, ask } = useConfirm()

  const saveM = (e: FormEvent) => {
    e.preventDefault()
    const raw = parseFloat(mForm.price), name = mForm.name.trim()
    if (!name || isNaN(raw)) return
    const saved = saveMarketEntry({ name, cat: mForm.cat, raw, mode: mForm.mode as Mode, date: mForm.date || today(), note: mForm.note.trim() }, mEdit)
    if (!saved) return
    setMForm({ ...mForm, price: '', note: '' })
    setMEdit(null)
    setOpen(false)
  }

  const editEntry = (m: MItem, x: MEntry) => {
    setMForm({ name: m.name, cat: m.cat, price: String(x.raw), mode: x.mode, date: x.date, note: x.note })
    setMEdit({ item: m.id, entry: x.id })
    setOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const delEntry = (m: MItem, x: MEntry) => {
    deleteMarketEntry(m, x)
    if (mEdit?.entry === x.id) setMEdit(null)
  }

  return (
    <>
      {!open && <button className="pri add" onClick={() => setOpen(true)}>+ Add price note</button>}
      {open && (
      <section className="panel">
        <h2>{mEdit ? 'Edit price note' : 'Add price note'}</h2>
        <form onSubmit={saveM} autoComplete="off" className="tform">
          <NameSuggest value={mForm.name} onType={(v) => setMForm({ ...mForm, name: v })} onPick={(n) => setMForm({ ...mForm, name: n })} />
          <label>Category
            <select value={mForm.cat} onChange={(e) => setMForm({ ...mForm, cat: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label>Market price
            <input type="number" min="0" step="any" required value={mForm.price} onChange={(e) => setMForm({ ...mForm, price: e.target.value })} placeholder="e.g. 11" />
            <select value={mForm.mode} onChange={(e) => setMForm({ ...mForm, mode: e.target.value })} aria-label="Price type">
              <option value="each">WL each</option>
              <option value="bulk">per 1 WL (e.g. 11/1)</option>
            </select>
          </label>
          <label>Date
            <input type="date" required value={mForm.date} onChange={(e) => setMForm({ ...mForm, date: e.target.value })} />
          </label>
          <label className="wide">Note (optional)
            <input maxLength={120} value={mForm.note} onChange={(e) => setMForm({ ...mForm, note: e.target.value })} placeholder="e.g. seen in the Block server" />
          </label>
          <div className="btns">
            <button className="pri" type="submit">{mEdit ? 'Save changes' : 'Add price note'}</button>
            <button type="button" onClick={() => { setMEdit(null); setMForm({ ...mForm, price: '', note: '' }); setOpen(false) }}>Cancel</button>
          </div>
        </form>
      </section>
      )}

      <div className="tools">
        <input type="search" value={mq} onChange={(e) => setMq(e.target.value)} placeholder="Search market items" aria-label="Search market items" />
      </div>
      {market.length === 0 && <div className="empty">No price notes yet. Add the first one above; it also updates the market price of a matching item.</div>}
      <div className="cards">
      {market
        .filter((m) => !mq.trim() || m.name.toLowerCase().includes(mq.trim().toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((m) => {
          const es = [...m.entries].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
          const cur = es[0], prv = es[1]
          const ch = prv ? Math.round((per(cur.raw, cur.mode) / per(prv.raw, prv.mode) - 1) * 100) : null
          return (
            <section className="panel" key={m.id}>
              <div className="mhead">
                <Thumb name={m.name} />
                <div className="g"><b>{m.name}</b><small className="tag">{m.cat}</small></div>
                <div className="mnow">
                  <b>{shown(cur.raw, cur.mode)}</b>
                  <small>as of {dlabel(cur.date)}</small>
                  {ch !== null && prv && <small className={ch > 0 ? 'up' : ch < 0 ? 'down' : ''}>{ch === 0 ? 'no change' : `${ch > 0 ? '+' : ''}${ch}%`} vs {dlabel(prv.date)}</small>}
                  {cur.note && <small>{cur.note}</small>}
                </div>
              </div>
              <details>
                <summary>History ({es.length})</summary>
                {es.map((x) => (
                  <div className="row" key={x.id}>
                    <span>{dlabel(x.date)}</span>
                    <span className="g"><b>{shown(x.raw, x.mode)}</b>{x.note && <small>{x.note}</small>}</span>
                    <button className="sm" onClick={() => editEntry(m, x)}>Edit</button>
                    <button className="sm del" onClick={() => ask(`e${x.id}`, () => delEntry(m, x))}>{armed === `e${x.id}` ? 'Confirm' : 'Delete'}</button>
                  </div>
                ))}
              </details>
              <div className="btns">
                <button className="sm" onClick={() => { setMEdit(null); setOpen(true); setMForm({ name: m.name, cat: m.cat, price: '', mode: cur.mode, date: today(), note: '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>New price</button>
                <button className="sm del" onClick={() => ask(`m${m.id}`, () => deleteMarketItem(m.id))}>{armed === `m${m.id}` ? 'Confirm delete' : 'Delete item'}</button>
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}
