import { useEffect, useMemo, useState } from 'react'

type Mode = 'each' | 'bulk'
type Item = { id: number; name: string; note: string; qty: number; cr: number; pr: number; cm: Mode; pm: Mode; mp?: number; mm?: Mode; mt?: number }
type Sale = { id: number; itemId: number; name: string; qty: number; revenue: number; cost: number; ts: number; mk?: number }
type Form = { name: string; cost: string; price: string; qty: string; note: string; cm: string; pm: string; market: string; mm: string }

const KEY = 'vend-items-v1'
const SKEY = 'vend-sales-v1'
const empty: Form = { name: '', cost: '', price: '', qty: '1', note: '', cm: 'each', pm: 'each', market: '', mm: 'each' }

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

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const stamp = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}` }
const dstr = (t: number) => { const d = new Date(t); return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}` }
// per-item price; tiny bulk values shown as "200 / 1 WL"
const each = (v: number) => (v > 0 && v < 1 ? `${Math.round(1 / v)} / 1 WL` : wl(v))
const u4 = (v: number) => Math.round(v * 10000) / 10000

// download rows as a CSV file (opens in Excel / Google Sheets)
const download = (name: string, rows: (string | number)[][]) => {
  const q = (v: string | number) => {
    let t = String(v)
    if (typeof v === 'string' && /^[=+\-@]/.test(t)) t = "'" + t
    return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const blob = new Blob(['\ufeff' + rows.map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

const RANGES: Record<string, string> = { today: 'Today', '7': 'Last 7 days', '30': 'Last 30 days', all: 'All time' }

type PdfTable = { title?: string; head: string[]; body: (string | number)[][]; foot?: (string | number)[] }

// build and save a PDF (loaded on demand so the app starts fast)
const makePdf = async (name: string, title: string, lines: string[], tables: PdfTable[]) => {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setFontSize(18)
  doc.text(title, 40, 44)
  doc.setFontSize(10)
  doc.setTextColor(90)
  lines.forEach((l, i) => doc.text(l, 40, 64 + i * 14))
  let y = 64 + lines.length * 14 + 12
  for (const t of tables) {
    if (y > doc.internal.pageSize.getHeight() - 90) { doc.addPage(); y = 40 }
    if (t.title) { doc.setFontSize(12); doc.setTextColor(0); doc.text(t.title, 40, y + 10); y += 16 }
    autoTable(doc, {
      startY: y,
      head: [t.head],
      body: t.body.map((r) => r.map(String)),
      foot: t.foot ? [t.foot.map(String)] : undefined,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [43, 100, 196] },
      footStyles: { fillColor: [230, 240, 247], textColor: 20 },
      margin: { left: 40, right: 40 },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 22
  }
  doc.save(name)
}

export default function App() {
  const [items, setItems] = useState<Item[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
  })
  const [sales, setSales] = useState<Sale[]>(() => {
    try { return JSON.parse(localStorage.getItem(SKEY) || '[]') } catch { return [] }
  })
  const [tab, setTab] = useState<'items' | 'report'>('items')
  const [range, setRange] = useState('7')
  const [form, setForm] = useState<Form>(empty)
  const [editId, setEditId] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('new')
  const [sure, setSure] = useState<number | null>(null)
  const [sold, setSold] = useState<Record<number, string>>({})

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* storage blocked */ }
  }, [items])

  useEffect(() => {
    try { localStorage.setItem(SKEY, JSON.stringify(sales)) } catch { /* storage blocked */ }
  }, [sales])

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const reset = () => { setForm(empty); setEditId(null) }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const cr = parseFloat(form.cost), pr = parseFloat(form.price), qty = parseInt(form.qty, 10)
    if (!form.name.trim() || isNaN(cr) || isNaN(pr) || isNaN(qty)) return
    const mpv = parseFloat(form.market)
    const mp = isNaN(mpv) ? undefined : mpv
    const mm = form.mm as Mode
    const prev = items.find((i) => i.id === editId)
    const mt = mp === undefined ? undefined : !prev || prev.mp !== mp || prev.mm !== mm ? Date.now() : prev.mt
    const d = { name: form.name.trim(), note: form.note.trim(), qty, cr, pr, cm: form.cm as Mode, pm: form.pm as Mode, mp, mm, mt }
    setItems(editId === null ? [...items, { id: Date.now(), ...d }] : items.map((i) => (i.id === editId ? { ...i, ...d } : i)))
    reset()
  }

  const edit = (i: Item) => {
    setForm({ name: i.name, cost: String(i.cr), price: String(i.pr), qty: String(i.qty), note: i.note, cm: i.cm, pm: i.pm, market: i.mp === undefined ? '' : String(i.mp), mm: i.mm ?? 'each' })
    setEditId(i.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const sell = (i: Item) => {
    const k = Math.min(i.qty, Math.max(1, parseInt(sold[i.id] || '1', 10) || 1))
    setItems(items.map((x) => (x.id === i.id ? { ...x, qty: x.qty - k } : x)))
    setSales([{ id: Date.now(), itemId: i.id, name: i.name, qty: k, revenue: per(i.pr, i.pm) * k, cost: per(i.cr, i.cm) * k, ts: Date.now(), mk: i.mp === undefined ? undefined : per(i.mp, i.mm ?? 'each') }, ...sales])
  }

  // undo a recorded sale and put the stock back
  const undo = (s: Sale) => {
    setSales(sales.filter((x) => x.id !== s.id))
    setItems(items.map((i) => (i.id === s.itemId ? { ...i, qty: i.qty + s.qty } : i)))
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

  const rep = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const from = range === 'today' ? start.getTime() : range === 'all' ? 0 : Date.now() - Number(range) * 86400000
    const v = sales.filter((x) => x.ts >= from)
    const byItem: Record<string, { name: string; qty: number; revenue: number; profit: number }> = {}
    const byDay: Record<string, Sale[]> = {}
    let units = 0, revenue = 0, profit = 0, cost = 0
    for (const x of v) {
      const pf = x.revenue - x.cost
      units += x.qty; revenue += x.revenue; profit += pf; cost += x.cost
      const t = (byItem[x.name] ??= { name: x.name, qty: 0, revenue: 0, profit: 0 })
      t.qty += x.qty; t.revenue += x.revenue; t.profit += pf
      const day = new Date(x.ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      (byDay[day] ??= []).push(x)
    }
    return { list: v, count: v.length, cost, units, revenue, profit, top: Object.values(byItem).sort((a, b) => b.profit - a.profit), days: Object.entries(byDay) }
  }, [sales, range])

  const exportItems = () =>
    download(`items-vend-${stamp()}.csv`, [
      ['Item', 'Note', 'Stock', 'Modal (input)', 'Modal type', 'Modal per item (WL)', 'Sell (input)', 'Sell type', 'Sell per item (WL)', 'Profit per item (WL)', 'Margin %', 'Stock value at modal (WL)', 'Profit if all sold (WL)', 'Market price (input)', 'Market type', 'Market per item (WL)', 'Sell vs market %', 'Market price updated'],
      ...items.map((i) => {
        const c1 = per(i.cr, i.cm), p1 = per(i.pr, i.pm), mkv = i.mp === undefined ? undefined : per(i.mp, i.mm ?? 'each')
        return [i.name, i.note, i.qty, i.cr, i.cm === 'bulk' ? 'items per 1 WL' : 'WL each', u4(c1), i.pr, i.pm === 'bulk' ? 'items per 1 WL' : 'WL each', u4(p1), u4(p1 - c1), c1 > 0 ? Math.round(((p1 - c1) / c1) * 100) : '', Math.round(c1 * i.qty), Math.round((p1 - c1) * i.qty), i.mp ?? '', i.mp === undefined ? '' : i.mm === 'bulk' ? 'items per 1 WL' : 'WL each', mkv === undefined ? '' : u4(mkv), mkv && mkv > 0 ? Math.round((p1 / mkv - 1) * 100) : '', i.mt ? dstr(i.mt) : '']
      }),
      ['TOTAL', '', tot.stock, '', '', '', '', '', '', '', '', Math.round(tot.cost), Math.round(tot.profit), '', '', '', '', ''],
    ])

  const exportSales = () =>
    download(`sales-vend-${stamp()}.csv`, [
      ['Date', 'Time', 'Item', 'Qty', 'Sell per item (WL)', 'Total sales (WL)', 'Total modal (WL)', 'Profit (WL)', 'Market per item at sale (WL)'],
      ...rep.list.map((x) => {
        const d = new Date(x.ts)
        return [`${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`, d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), x.name, x.qty, u4(x.revenue / x.qty), Math.round(x.revenue), Math.round(x.cost), Math.round(x.revenue - x.cost), x.mk === undefined ? '' : u4(x.mk)]
      }),
      ['TOTAL', '', '', rep.units, '', Math.round(rep.revenue), Math.round(rep.cost), Math.round(rep.profit), ''],
    ])

  const exportItemsPdf = () =>
    makePdf(
      `items-vend-${stamp()}.pdf`,
      'Vend Shop - Items',
      [
        `Date: ${dstr(Date.now())}`,
        `Items: ${items.length}   |   In stock: ${tot.stock}   |   Money tied up (modal): ${wl(tot.cost)}   |   Profit if all sold: ${wl(tot.profit)}`,
      ],
      [{
        head: ['Item', 'Stock', 'Modal', 'Sell', 'Market price (updated)', 'Sell vs market', 'Profit (all stock)'],
        body: items.map((i) => {
          const pe = profitEach(i)
          const mkv = i.mp === undefined ? null : per(i.mp, i.mm ?? 'each')
          const md = mkv && mkv > 0 ? Math.round((per(i.pr, i.pm) / mkv - 1) * 100) : null
          return [
            i.note ? `${i.name} (${i.note})` : i.name,
            i.qty,
            shown(i.cr, i.cm),
            shown(i.pr, i.pm),
            i.mp === undefined ? '-' : `${shown(i.mp, i.mm ?? 'each')}${i.mt ? ` (${dstr(i.mt)})` : ''}`,
            md === null ? '-' : md === 0 ? 'Equal' : `${Math.abs(md)}% ${md > 0 ? 'above' : 'below'}`,
            `${pe >= 0 ? '+' : ''}${wl(pe * i.qty)}`,
          ]
        }),
        foot: ['TOTAL', tot.stock, '', '', '', '', wl(tot.profit)],
      }],
    )

  const exportSalesPdf = () =>
    makePdf(
      `sales-vend-${stamp()}.pdf`,
      'Vend Shop - Sales Report',
      [
        `Period: ${RANGES[range]}   |   Generated: ${dstr(Date.now())}`,
        `Transactions: ${rep.count}   |   Items sold: ${rep.units}   |   Total sales: ${wl(rep.revenue)}   |   Total modal: ${wl(rep.cost)}   |   Total profit: ${wl(rep.profit)}${rep.cost > 0 ? `   |   Margin: ${Math.round((rep.profit / rep.cost) * 100)}%` : ''}`,
      ],
      [
        {
          title: 'By item',
          head: ['Item', 'Sold', 'Total sales', 'Profit'],
          body: rep.top.map((t) => [t.name, t.qty, wl(t.revenue), `${t.profit >= 0 ? '+' : ''}${wl(t.profit)}`]),
        },
        {
          title: 'Transactions',
          head: ['Date', 'Time', 'Item', 'Qty', 'Sell each', 'Total sales', 'Modal', 'Profit', 'Market each (at sale)'],
          body: rep.list.map((x) => {
            const pf = x.revenue - x.cost
            return [
              dstr(x.ts),
              new Date(x.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
              x.name,
              x.qty,
              each(x.revenue / x.qty),
              wl(x.revenue),
              wl(x.cost),
              `${pf >= 0 ? '+' : ''}${wl(pf)}`,
              x.mk === undefined ? '-' : each(x.mk),
            ]
          }),
          foot: ['TOTAL', '', '', rep.units, '', wl(rep.revenue), wl(rep.cost), wl(rep.profit), ''],
        },
      ],
    )

  const c = per(parseFloat(form.cost), form.cm as Mode)
  const p = per(parseFloat(form.price), form.pm as Mode)
  const d = p - c
  const fq = parseInt(form.qty, 10) || 0
  const mk = per(parseFloat(form.market), form.mm as Mode)
  const mdiff = !isNaN(mk) && mk > 0 && !isNaN(p) ? Math.round((p / mk - 1) * 100) : null
  const mtxt = mdiff === null ? '' : mdiff === 0 ? ' Your sell price equals the market price.' : ` Your sell price is ${Math.abs(mdiff)}% ${mdiff > 0 ? 'above' : 'below'} market.`
  const preview = isNaN(d)
    ? 'Fill in modal and sell price to see your profit.'
    : `${Math.abs(d) >= 1 ? `Profit each: ${d >= 0 ? '+' : ''}${wl(d)}. ` : ''}Profit for ${fq} in stock: ${d * fq >= 0 ? '+' : ''}${wl(d * fq)}.${mtxt}`

  const modeSelect = (k: 'cm' | 'pm' | 'mm') => (
    <select value={form[k]} onChange={set(k)} aria-label={k === 'cm' ? 'Modal type' : k === 'pm' ? 'Sell price type' : 'Market price type'}>
      <option value="each">WL each</option>
      <option value="bulk">items per 1 WL (e.g. 200/1)</option>
    </select>
  )

  return (
    <main>
      <h1>Vend Shop Tracker</h1>
      <p className="sub">Keep every item's cost (modal), sell price and stock in one place. Prices are in World Locks (WL). 100 WL = 1 DL.</p>

      <div className="tabs">
        <button aria-pressed={tab === 'items'} onClick={() => setTab('items')}>Items</button>
        <button aria-pressed={tab === 'report'} onClick={() => setTab('report')}>Sales report</button>
      </div>

      {tab === 'items' && (
        <>
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
          <label>Market price (optional)
            <input type="number" min="0" step="any" value={form.market} onChange={set('market')} placeholder="Price right now" />
            {modeSelect('mm')}
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
        <button className="pri" onClick={exportItemsPdf}>Download PDF</button>
        <button onClick={exportItems}>CSV</button>
      </div>

      {list.length === 0 && (
        <div className="empty">{items.length ? 'No items match your search.' : 'No items yet. Add your first item above.'}</div>
      )}
      {list.map((i) => {
        const pe = profitEach(i)
        const mkt = i.mp === undefined ? null : per(i.mp, i.mm ?? 'each')
        const md = mkt && mkt > 0 ? Math.round((per(i.pr, i.pm) / mkt - 1) * 100) : null
        const margin = i.cr > 0 ? Math.round((pe / per(i.cr, i.cm)) * 100) : null
        return (
          <div key={i.id} className={`item${i.qty === 0 ? ' out' : ''}`}>
            <div className="name">{i.name}{i.note && <small>{i.note}</small>}</div>
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
        </>
      )}

      {tab === 'report' && (
        <>
          <div className="tools">
            <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Period">
              <option value="today">Today</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="all">All time</option>
            </select>
            <button className="pri" onClick={exportSalesPdf}>Download PDF</button>
            <button onClick={exportSales}>CSV</button>
          </div>
          <div className="sum" aria-live="polite">
            <div><b>{rep.count}</b><span>Transactions</span></div>
            <div><b>{rep.units}</b><span>Items sold</span></div>
            <div><b>{wl(rep.revenue)}</b><span>Total sales</span></div>
            <div><b>{wl(rep.cost)}</b><span>Total modal</span></div>
            <div><b className={rep.profit >= 0 ? 'up' : 'down'}>{wl(rep.profit)}</b><span>Total profit</span></div>
            <div><b>{rep.cost > 0 ? Math.round((rep.profit / rep.cost) * 100) + '%' : '-'}</b><span>Profit margin</span></div>
          </div>
          {rep.count > 0 && (
            <p className="sub">
              Best item: {rep.top[0].name} ({wl(rep.top[0].profit)} profit). Average profit per transaction: {wl(rep.profit / rep.count)}.
            </p>
          )}
          {rep.days.length === 0 && <div className="empty">No sales in this period. Tap Sold on an item to record one.</div>}
          {rep.top.length > 0 && (
            <section className="panel">
              <h2>By item</h2>
              {rep.top.map((t) => (
                <div className="row" key={t.name}>
                  <span className="g">{t.name}</span><span>{t.qty} sold</span><b>{wl(t.revenue)}</b>
                  <b className={t.profit >= 0 ? 'up' : 'down'}>{t.profit >= 0 ? '+' : ''}{wl(t.profit)}</b>
                </div>
              ))}
            </section>
          )}
          {rep.days.map(([day, list]) => {
            const dr = list.reduce((n, x) => n + x.revenue, 0), dp = list.reduce((n, x) => n + x.revenue - x.cost, 0)
            return (
              <section className="panel" key={day}>
                <h2>{day}<small>{wl(dr)} sales, {dp >= 0 ? '+' : ''}{wl(dp)} profit</small></h2>
                {list.map((x) => (
                  <div className="row" key={x.id}>
                    <span>{new Date(x.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="g">{x.name} x{x.qty}<small>{each(x.revenue / x.qty)} each, modal {wl(x.cost)}{x.mk !== undefined && `, market ${each(x.mk)}`}</small></span><b>{wl(x.revenue)}</b>
                    <b className={x.revenue - x.cost >= 0 ? 'up' : 'down'}>{x.revenue - x.cost >= 0 ? '+' : ''}{wl(x.revenue - x.cost)}</b>
                    <button className="sm" onClick={() => undo(x)}>Undo</button>
                  </div>
                ))}
              </section>
            )
          })}
        </>
      )}
    </main>
  )
}
