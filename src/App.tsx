import { useEffect, useMemo, useState } from 'react'

type Mode = 'each' | 'bulk'
type Item = { id: number; name: string; note: string; qty: number; cr: number; pr: number; cm: Mode; pm: Mode }
type Form = { name: string; cost: string; price: string; qty: string; note: string; cm: string; pm: string }

const KEY = 'vend-items-v1'
const empty: Form = { name: '', cost: '', price: '', qty: '1', note: '', cm: 'each', pm: 'each' }

// bulk "200/1" means 200 items for 1 WL, so one item costs 1/200 WL
const per = (raw: number, m: Mode) => (isNaN(raw) ? NaN : m === 'bulk' ? (raw > 0 ? 1 / raw : 0) : raw)

const wl = (v: number) => {
  const r = Math.round(v), a = Math.abs(r)
  let s = `${r} WL`
  if (a >= 100) s += ` (${r < 0 ? '-' : ''}${Math.floor(a / 100)} DL${a % 100 ? ` ${a % 100} WL` : ''})`
  return s
}
const shown = (raw: number, m: Mode) => (m === 'bulk' ? `${raw} / 1 WL` : wl(raw))
const profitEach = (i: Item) => per(i.pr, i.pm) - per(i.cr, i.cm)

export default function App() {
  const [items, setItems] = useState<Item[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
  })
  const [form, setForm] = useState<Form>(empty)
  const [editId, setEditId] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('new')
  const [sure, setSure] = useState<number | null>(null)
  const [sold, setSold] = useState<Record<number, string>>({})

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* storage blocked */ }
  }, [items])

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const reset = () => { setForm(empty); setEditId(null) }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const cr = parseFloat(form.cost), pr = parseFloat(form.price), qty = parseInt(form.qty, 10)
    if (!form.name.trim() || isNaN(cr) || isNaN(pr) || isNaN(qty)) return
    const d = { name: form.name.trim(), note: form.note.trim(), qty, cr, pr, cm: form.cm as Mode, pm: form.pm as Mode }
    setItems(editId === null ? [...items, { id: Date.now(), ...d }] : items.map((i) => (i.id === editId ? { ...i, ...d } : i)))
    reset()
  }

  const edit = (i: Item) => {
    setForm({ name: i.name, cost: String(i.cr), price: String(i.pr), qty: String(i.qty), note: i.note, cm: i.cm, pm: i.pm })
    setEditId(i.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const sell = (i: Item) => {
    const k = Math.min(i.qty, Math.max(1, parseInt(sold[i.id] || '1', 10) || 1))
    setItems(items.map((x) => (x.id === i.id ? { ...x, qty: x.qty - k } : x)))
  }

  const remove = (id: number) => {
    if (sure === id) {
      setItems(items.filter((i) => i.id !== id))
      if (editId === id) reset()
      setSure(null)
    } else {
      setSure(id)
      setTimeout(() => setSure((s) => (s === id ? null : s)), 3000)
    }
  }

  const list = useMemo(() => {
    const v = items.filter((i) => !q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase()))
    return v.sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name)
      : sort === 'profit' ? profitEach(b) - profitEach(a)
      : sort === 'price' ? per(b.pr, b.pm) - per(a.pr, a.pm)
      : b.id - a.id)
  }, [items, q, sort])

  const tot = items.reduce(
    (t, i) => ({ stock: t.stock + i.qty, cost: t.cost + per(i.cr, i.cm) * i.qty, profit: t.profit + profitEach(i) * i.qty }),
    { stock: 0, cost: 0, profit: 0 },
  )

  const c = per(parseFloat(form.cost), form.cm as Mode)
  const p = per(parseFloat(form.price), form.pm as Mode)
  const d = p - c
  const fq = parseInt(form.qty, 10) || 0
  const preview = isNaN(d)
    ? 'Fill in modal and sell price to see your profit.'
    : `${Math.abs(d) >= 1 ? `Profit each: ${d >= 0 ? '+' : ''}${wl(d)}. ` : ''}Profit for ${fq} in stock: ${d * fq >= 0 ? '+' : ''}${wl(d * fq)}.`

  const modeSelect = (k: 'cm' | 'pm') => (
    <select value={form[k]} onChange={set(k)} aria-label={k === 'cm' ? 'Modal type' : 'Sell price type'}>
      <option value="each">WL each</option>
      <option value="bulk">items per 1 WL (e.g. 200/1)</option>
    </select>
  )

  return (
    <main>
      <h1>Vend Shop Tracker</h1>
      <p className="sub">Keep every item's cost (modal), sell price and stock in one place. Prices are in World Locks (WL). 100 WL = 1 DL.</p>

      <div className="sum" aria-live="polite">
        <div><b>{tot.stock}</b><span>Items in stock</span></div>
        <div><b>{wl(tot.cost)}</b><span>Money tied up (modal)</span></div>
        <div><b>{wl(tot.profit)}</b><span>Profit if all sold</span></div>
      </div>

      <section className="panel">
        <h2>{editId === null ? 'Add item' : 'Edit item'}</h2>
        <form onSubmit={submit} autoComplete="off">
          <label>Item name
            <input required maxLength={60} value={form.name} onChange={set('name')} placeholder="e.g. Angel Wings" />
          </label>
          <label>Modal
            <input type="number" min="0" step="any" required value={form.cost} onChange={set('cost')} placeholder="0" />
            {modeSelect('cm')}
          </label>
          <label>Sell price
            <input type="number" min="0" step="any" required value={form.price} onChange={set('price')} placeholder="0" />
            {modeSelect('pm')}
          </label>
          <label>Stock
            <input type="number" min="0" step="1" required value={form.qty} onChange={set('qty')} />
          </label>
          <label className="note">Note (optional)
            <input maxLength={120} value={form.note} onChange={set('note')} placeholder="Where you bought it, vend world, etc." />
          </label>
          <div className="preview">{preview}</div>
          <div className="btns">
            <button className="pri" type="submit">{editId === null ? 'Add item' : 'Save changes'}</button>
            {editId !== null && <button type="button" onClick={reset}>Cancel edit</button>}
          </div>
        </form>
      </section>

      <div className="tools">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items" aria-label="Search items" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort items">
          <option value="new">Newest first</option>
          <option value="name">Name A-Z</option>
          <option value="profit">Highest profit</option>
          <option value="price">Highest sell price</option>
        </select>
      </div>

      {list.length === 0 && (
        <div className="empty">{items.length ? 'No items match your search.' : 'No items yet. Add your first item above.'}</div>
      )}
      {list.map((i) => {
        const pe = profitEach(i)
        const margin = i.cr > 0 ? Math.round((pe / per(i.cr, i.cm)) * 100) : null
        return (
          <div key={i.id} className={`item${i.qty === 0 ? ' out' : ''}`}>
            <div className="name">{i.name}{i.note && <small>{i.note}</small>}</div>
            <div className="c"><small>Modal</small><b>{shown(i.cr, i.cm)}</b></div>
            <div className="c sell"><small>Sell</small><b>{shown(i.pr, i.pm)}</b></div>
            <div className="c">
              <small>Profit (all stock)</small>
              <b className={pe >= 0 ? 'up' : 'down'}>{pe >= 0 ? '+' : ''}{wl(pe * i.qty)}</b>
              {margin !== null && <small>{margin}% margin</small>}
            </div>
            <div className="c"><small>Stock</small><b>{i.qty}{i.qty === 0 ? ' (sold out)' : ''}</b></div>
            <div className="act">
              <input className="sq" type="number" min="1" max={i.qty} value={sold[i.id] ?? '1'} disabled={i.qty === 0}
                onChange={(e) => setSold({ ...sold, [i.id]: e.target.value })} aria-label="Quantity sold" />
              <button className="sm" disabled={i.qty === 0} onClick={() => sell(i)}>Sold</button>
              <button className="sm" onClick={() => edit(i)}>Edit</button>
              <button className="sm del" onClick={() => remove(i.id)}>{sure === i.id ? 'Confirm delete' : 'Delete'}</button>
            </div>
          </div>
        )
      })}
      <p className="sub" style={{ marginTop: 16 }}>Your items are saved in this browser on this device only.</p>
    </main>
  )
}
