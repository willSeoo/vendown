import { useEffect, useMemo, useState } from 'react'

type Mode = 'each' | 'bulk'
type Item = { id: number; name: string; note: string; qty: number; cr: number; pr: number; cm: Mode; pm: Mode; mp?: number; mm?: Mode; mt?: number; cat?: string; showPrice?: boolean }
type Sale = { id: number; itemId: number; name: string; qty: number; revenue: number; cost: number; ts: number; mk?: number; cat?: string }
type Form = { name: string; cost: string; price: string; qty: string; note: string; cm: string; pm: string; market: string; mm: string; cat: string; showPrice: boolean }

const KEY = 'vend-items-v1'
const SKEY = 'vend-sales-v1'
const empty: Form = { name: '', cost: '', price: '', qty: '1', note: '', cm: 'each', pm: 'each', market: '', mm: 'each', cat: 'Item', showPrice: false }

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

const CATS = ['Block', 'Background', 'Consumable', 'Surgery', 'Clothing', 'Seed', 'Item', 'Other']
const catOf = (x: { cat?: string }) => x.cat ?? 'Other'
type Template = { id: number; name: string; cat: string; header: string; footer: string; verb: string; sep: string; prices: 'none' | 'all' | 'marked'; stockOnly: boolean }
type TForm = Omit<Template, 'id'>
const emptyT: TForm = { name: '', cat: 'Block', header: 'SELL AT QLOUN', footer: 'SELL AT QLOUN', verb: 'Sell', sep: ' | ', prices: 'marked', stockOnly: true }

// price as written in Discord: "2/1" for bulk, "3 WL", "2 DL"
const promoPrice = (i: Item) => {
  if (i.pm === 'bulk') return `${i.pr}/1`
  const v = Math.round(i.pr)
  return v >= 100 && v % 100 === 0 ? `${v / 100} DL` : `${v} WL`
}

// build the Discord messages (max 2000 characters each; header and footer repeat in every message)
const buildPromo = (t: TForm, all: Item[]) => {
  const list = all.filter((i) => (t.cat === 'all' || catOf(i) === t.cat) && (!t.stockOnly || i.qty > 0))
  const parts = list.map((i) => {
    const price = t.prices === 'all' || (t.prices === 'marked' && i.showPrice) ? promoPrice(i) : ''
    return [t.verb.trim(), i.name, price].filter(Boolean).join(' ')
  })
  const head = t.header ? t.header + '\n\n' : ''
  const foot = t.footer ? '\n\n' + t.footer : ''
  const limit = 2000 - head.length - foot.length
  const bodies: string[] = []
  let cur = ''
  for (const p of parts) {
    const next = cur ? cur + t.sep + p : p
    if (cur && next.length > limit) { bodies.push(cur); cur = p } else cur = next
  }
  if (cur) bodies.push(cur)
  return { count: list.length, msgs: bodies.map((b) => head + b + foot) }
}

type MEntry = { id: number; raw: number; mode: Mode; date: string; note: string }
type MItem = { id: number; name: string; cat: string; entries: MEntry[] }
type ImgRec = { key: string; name: string; blob: Blob }

const pad = (n: number) => String(n).padStart(2, '0')
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const dts = (d: string) => new Date(d + 'T12:00:00').getTime()
const dlabel = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const latestOf = (m: MItem) => m.entries.reduce<MEntry | undefined>((a, e) => (!a || e.date >= a.date ? e : a), undefined)

// item names and image file names are matched ignoring case, extension and punctuation
const nkey = (s: string) => s.toLowerCase().replace(/\.(png|jpe?g|webp|gif|bmp|avif)$/i, '').replace(/[^a-z0-9]+/g, ' ').trim()

// images live in IndexedDB (too big for localStorage)
const idb = () => new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open('vend-shop', 1)
  r.onupgradeneeded = () => r.result.createObjectStore('img', { keyPath: 'key' })
  r.onsuccess = () => res(r.result)
  r.onerror = () => rej(r.error)
})
const idbAll = async () => {
  const db = await idb()
  return new Promise<ImgRec[]>((res, rej) => { const q = db.transaction('img').objectStore('img').getAll(); q.onsuccess = () => res(q.result as ImgRec[]); q.onerror = () => rej(q.error) })
}
const idbPut = async (rec: ImgRec) => {
  const db = await idb()
  return new Promise<void>((res, rej) => { const t = db.transaction('img', 'readwrite'); t.objectStore('img').put(rec); t.oncomplete = () => res(); t.onerror = () => rej(t.error) })
}
const idbDel = async (key: string) => {
  const db = await idb()
  return new Promise<void>((res, rej) => { const t = db.transaction('img', 'readwrite'); t.objectStore('img').delete(key); t.oncomplete = () => res(); t.onerror = () => rej(t.error) })
}
// shrink big pictures so storage stays small
const shrink = async (file: File, max = 160): Promise<Blob> => {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k))
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('image'))), 'image/webp', 0.85))
}

// any picture (webp etc.) to a crisp png data URL for the PDF
const toPng = (url: string) => new Promise<string | null>((res) => {
  const im = new Image()
  im.onload = () => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const x = c.getContext('2d')!
    x.imageSmoothingEnabled = false
    const k = Math.min(64 / im.width, 64 / im.height), w = im.width * k, h = im.height * k
    x.drawImage(im, (64 - w) / 2, (64 - h) / 2, w, h)
    res(c.toDataURL('image/png'))
  }
  im.onerror = () => res(null)
  im.src = url
})

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

type PdfTable = { imgNames?: string[]; imgCol?: number; title?: string; head: string[]; body: (string | number)[][]; foot?: (string | number)[] }

// build and save a PDF (loaded on demand so the app starts fast)
const makePdf = async (name: string, title: string, lines: string[], tables: PdfTable[], pics: Record<string, string> = {}) => {
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
    if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = 40 }
    if (t.title) {
      doc.setFillColor(43, 100, 196)
      doc.rect(40, y, doc.internal.pageSize.getWidth() - 80, 20, 'F')
      doc.setFontSize(11)
      doc.setTextColor(255)
      doc.text(t.title, 48, y + 14)
      y += 20
    }
    autoTable(doc, {
      startY: y,
      head: [t.head],
      body: t.body.map((r) => r.map(String)),
      foot: t.foot ? [t.foot.map(String)] : undefined,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [225, 234, 244], textColor: 20 },
      footStyles: { fillColor: [230, 240, 247], textColor: 20 },
      margin: { left: 40, right: 40 },
      columnStyles: t.imgNames ? { [t.imgCol ?? 0]: { cellPadding: { top: 4, bottom: 4, left: 32, right: 4 } } } : undefined,
      bodyStyles: t.imgNames ? { minCellHeight: 28, valign: 'middle' } : undefined,
      didDrawCell: (d) => {
        if (!t.imgNames || d.section !== 'body' || d.column.index !== (t.imgCol ?? 0)) return
        const nm = t.imgNames[d.row.index], k = nm ? nkey(nm) : ''
        if (k && pics[k]) doc.addImage(pics[k], 'PNG', d.cell.x + 5, d.cell.y + (d.cell.height - 22) / 2, 22, 22, k)
      },
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
  const [tab, setTab] = useState<'items' | 'report' | 'promo' | 'market' | 'images'>('items')
  const [range, setRange] = useState('7')
  const [catFilter, setCatFilter] = useState('all')
  const [templates, setTemplates] = useState<Template[]>(() => {
    try { return JSON.parse(localStorage.getItem('vend-templates-v1') || '[]') } catch { return [] }
  })
  const [tForm, setTForm] = useState<TForm>(emptyT)
  const [tEditId, setTEditId] = useState<number | null>(null)
  const [tSure, setTSure] = useState<number | null>(null)
  const [copied, setCopied] = useState('')
  const [market, setMarket] = useState<MItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('vend-market-v1') || '[]') } catch { return [] }
  })
  const [mForm, setMForm] = useState({ name: '', cat: 'Block', price: '', mode: 'each', date: today(), note: '' })
  const [mEdit, setMEdit] = useState<{ item: number; entry: number } | null>(null)
  const [mSure, setMSure] = useState('')
  const [mq, setMq] = useState('')
  const [imgs, setImgs] = useState<Record<string, { name: string; url: string }>>({})
  const [imgMsg, setImgMsg] = useState('')
  const [sugFor, setSugFor] = useState('')
  const [open, setOpen] = useState('')
  const [openIds, setOpenIds] = useState<number[]>([])
  const [builtin, setBuiltin] = useState<Record<string, { name: string; url: string }>>({})
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

  useEffect(() => {
    try { localStorage.setItem('vend-templates-v1', JSON.stringify(templates)) } catch { /* storage blocked */ }
  }, [templates])

  useEffect(() => {
    try { localStorage.setItem('vend-market-v1', JSON.stringify(market)) } catch { /* storage blocked */ }
  }, [market])

  // pictures shipped with the app in public/items (listed in public/items/index.json)
  useEffect(() => {
    const base = import.meta.env.BASE_URL
    fetch(`${base}items/index.json`)
      .then((r) => r.json())
      .then((list: string[]) => {
        const m: Record<string, { name: string; url: string }> = {}
        list.forEach((f) => { const name = f.replace(/\.[^.]+$/, ''); m[nkey(name)] = { name, url: `${base}items/${encodeURIComponent(f)}` } })
        setBuiltin(m)
      })
      .catch(() => { /* no built-in pictures */ })
  }, [])

  useEffect(() => {
    idbAll().then((recs) => {
      const m: Record<string, { name: string; url: string }> = {}
      recs.forEach((r) => { m[r.key] = { name: r.name, url: URL.createObjectURL(r.blob) } })
      setImgs(m)
    }).catch(() => setImgMsg('Images cannot be saved in this browser mode.'))
  }, [])

  const set = (k: Exclude<keyof Form, 'showPrice'>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const reset = () => { setForm(empty); setEditId(null); setOpen('') }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const cr = parseFloat(form.cost), pr = parseFloat(form.price), qty = parseInt(form.qty, 10)
    if (!form.name.trim() || isNaN(cr) || isNaN(pr) || isNaN(qty)) return
    const mpv = parseFloat(form.market)
    const mp = isNaN(mpv) ? undefined : mpv
    const mm = form.mm as Mode
    const prev = items.find((i) => i.id === editId)
    const mt = mp === undefined ? undefined : !prev || prev.mp !== mp || prev.mm !== mm ? Date.now() : prev.mt
    const d = { name: form.name.trim(), note: form.note.trim(), qty, cr, pr, cm: form.cm as Mode, pm: form.pm as Mode, mp, mm, mt, cat: form.cat, showPrice: form.showPrice }
    if (mp !== undefined && (!prev || prev.mp !== mp || prev.mm !== mm)) logMarket(d.name, d.cat, mp, mm)
    setItems(editId === null ? [...items, { id: Date.now(), ...d }] : items.map((i) => (i.id === editId ? { ...i, ...d } : i)))
    reset()
  }

  const edit = (i: Item) => {
    setForm({ name: i.name, cost: String(i.cr), price: String(i.pr), qty: String(i.qty), note: i.note, cm: i.cm, pm: i.pm, market: i.mp === undefined ? '' : String(i.mp), mm: i.mm ?? 'each', cat: catOf(i), showPrice: !!i.showPrice })
    setEditId(i.id)
    setOpen('item')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const sell = (i: Item) => {
    const k = Math.min(i.qty, Math.max(1, parseInt(sold[i.id] || '1', 10) || 1))
    setItems(items.map((x) => (x.id === i.id ? { ...x, qty: x.qty - k } : x)))
    setSales([{ id: Date.now(), itemId: i.id, name: i.name, qty: k, revenue: per(i.pr, i.pm) * k, cost: per(i.cr, i.cm) * k, ts: Date.now(), mk: i.mp === undefined ? undefined : per(i.mp, i.mm ?? 'each'), cat: catOf(i) }, ...sales])
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
    const v = items.filter((i) => (catFilter === 'all' || catOf(i) === catFilter) && (!q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase())))
    return v.sort((a, b) =>
      sort === 'cat' ? CATS.indexOf(catOf(a)) - CATS.indexOf(catOf(b)) || a.name.localeCompare(b.name)
      : sort === 'name' ? a.name.localeCompare(b.name)
      : sort === 'profit' ? profitEach(b) - profitEach(a)
      : sort === 'price' ? per(b.pr, b.pm) - per(a.pr, a.pm)
      : b.id - a.id)
  }, [items, q, sort, catFilter])

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
      ['Item', 'Note', 'Stock', 'Modal (input)', 'Modal type', 'Modal per item (WL)', 'Sell (input)', 'Sell type', 'Sell per item (WL)', 'Profit per item (WL)', 'Margin %', 'Stock value at modal (WL)', 'Profit if all sold (WL)', 'Market price (input)', 'Market type', 'Market per item (WL)', 'Sell vs market %', 'Market price updated', 'Category'],
      ...items.map((i) => {
        const c1 = per(i.cr, i.cm), p1 = per(i.pr, i.pm), mkv = i.mp === undefined ? undefined : per(i.mp, i.mm ?? 'each')
        return [i.name, i.note, i.qty, i.cr, i.cm === 'bulk' ? 'items per 1 WL' : 'WL each', u4(c1), i.pr, i.pm === 'bulk' ? 'items per 1 WL' : 'WL each', u4(p1), u4(p1 - c1), c1 > 0 ? Math.round(((p1 - c1) / c1) * 100) : '', Math.round(c1 * i.qty), Math.round((p1 - c1) * i.qty), i.mp ?? '', i.mp === undefined ? '' : i.mm === 'bulk' ? 'items per 1 WL' : 'WL each', mkv === undefined ? '' : u4(mkv), mkv && mkv > 0 ? Math.round((p1 / mkv - 1) * 100) : '', i.mt ? dstr(i.mt) : '', catOf(i)]
      }),
      ['TOTAL', '', tot.stock, '', '', '', '', '', '', '', '', Math.round(tot.cost), Math.round(tot.profit), '', '', '', '', '', ''],
    ])

  const exportSales = () =>
    download(`sales-vend-${stamp()}.csv`, [
      ['Date', 'Time', 'Item', 'Qty', 'Sell per item (WL)', 'Total sales (WL)', 'Total modal (WL)', 'Profit (WL)', 'Market per item at sale (WL)', 'Category'],
      ...rep.list.map((x) => {
        const d = new Date(x.ts)
        return [`${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`, d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), x.name, x.qty, u4(x.revenue / x.qty), Math.round(x.revenue), Math.round(x.cost), Math.round(x.revenue - x.cost), x.mk === undefined ? '' : u4(x.mk), x.cat ?? items.find((i) => i.id === x.itemId)?.cat ?? 'Other']
      }),
      ['TOTAL', '', '', rep.units, '', Math.round(rep.revenue), Math.round(rep.cost), Math.round(rep.profit), '', ''],
    ])

  const exportItemsPdf = async () => {
    const pics = await loadPics(items.map((i) => i.name))
    const groups = CATS.filter((g) => items.some((i) => catOf(i) === g))
    const stat = (l: Item[]) => ({
      stock: l.reduce((n, i) => n + i.qty, 0),
      cost: l.reduce((n, i) => n + per(i.cr, i.cm) * i.qty, 0),
      profit: l.reduce((n, i) => n + profitEach(i) * i.qty, 0),
    })
    const row = (i: Item) => {
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
    }
    return makePdf(
      `items-vend-${stamp()}.pdf`,
      'Vend Shop - Items',
      [
        `Date: ${dstr(Date.now())}`,
        `Items: ${items.length}   |   In stock: ${tot.stock}   |   Money tied up (modal): ${wl(tot.cost)}   |   Profit if all sold: ${wl(tot.profit)}`,
      ],
      [
        {
          title: 'SUMMARY BY CATEGORY',
          head: ['Category', 'Items', 'In stock', 'Money tied up (modal)', 'Profit if all sold'],
          body: groups.map((g) => {
            const l = items.filter((i) => catOf(i) === g), t = stat(l)
            return [g, l.length, t.stock, wl(t.cost), wl(t.profit)]
          }),
          foot: ['TOTAL', items.length, tot.stock, wl(tot.cost), wl(tot.profit)],
        },
        ...groups.map((g) => {
          const l = items.filter((i) => catOf(i) === g).sort((x, y) => x.name.localeCompare(y.name))
          const t = stat(l)
          return {
            title: `${g.toUpperCase()}  (${l.length} item${l.length > 1 ? 's' : ''})`,
            head: ['Item', 'Stock', 'Modal', 'Sell', 'Market price (updated)', 'Sell vs market', 'Profit (all stock)'],
            body: l.map(row),
            imgNames: l.map((i) => i.name),
            foot: ['Subtotal', t.stock, '', '', '', '', wl(t.profit)],
          }
        }),
      ],
      pics,
    )
  }

  const exportSalesPdf = async () => {
    const pics = await loadPics(rep.list.map((x) => x.name))
    const catFor = (x: Sale) => x.cat ?? items.find((i) => i.id === x.itemId)?.cat ?? 'Other'
    const groups = CATS.filter((g) => rep.list.some((x) => catFor(x) === g))
    const sum = (l: Sale[]) => ({
      units: l.reduce((n, x) => n + x.qty, 0),
      revenue: l.reduce((n, x) => n + x.revenue, 0),
      cost: l.reduce((n, x) => n + x.cost, 0),
    })
    const trow = (x: Sale) => {
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
    }
    return makePdf(
      `sales-vend-${stamp()}.pdf`,
      'Vend Shop - Sales Report',
      [
        `Period: ${RANGES[range]}   |   Generated: ${dstr(Date.now())}`,
        `Transactions: ${rep.count}   |   Items sold: ${rep.units}   |   Total sales: ${wl(rep.revenue)}   |   Total modal: ${wl(rep.cost)}   |   Total profit: ${wl(rep.profit)}${rep.cost > 0 ? `   |   Margin: ${Math.round((rep.profit / rep.cost) * 100)}%` : ''}`,
      ],
      [
        {
          title: 'SUMMARY BY CATEGORY',
          head: ['Category', 'Transactions', 'Items sold', 'Total sales', 'Total modal', 'Profit'],
          body: groups.map((g) => {
            const l = rep.list.filter((x) => catFor(x) === g), t = sum(l)
            return [g, l.length, t.units, wl(t.revenue), wl(t.cost), `${t.revenue - t.cost >= 0 ? '+' : ''}${wl(t.revenue - t.cost)}`]
          }),
          foot: ['TOTAL', rep.count, rep.units, wl(rep.revenue), wl(rep.cost), wl(rep.profit)],
        },
        {
          title: 'BY ITEM',
          head: ['Item', 'Sold', 'Total sales', 'Profit'],
          body: rep.top.map((t) => [t.name, t.qty, wl(t.revenue), `${t.profit >= 0 ? '+' : ''}${wl(t.profit)}`]),
          imgNames: rep.top.map((t) => t.name),
        },
        ...groups.map((g) => {
          const l = rep.list.filter((x) => catFor(x) === g), t = sum(l)
          return {
            title: `${g.toUpperCase()}  (${l.length} transaction${l.length > 1 ? 's' : ''})`,
            head: ['Date', 'Time', 'Item', 'Qty', 'Sell each', 'Total sales', 'Modal', 'Profit', 'Market each (at sale)'],
            body: l.map(trow),
            imgNames: l.map((x) => x.name),
            imgCol: 2,
            foot: ['Subtotal', '', '', t.units, '', wl(t.revenue), wl(t.cost), wl(t.revenue - t.cost), ''],
          }
        }),
      ],
      pics,
    )
  }

  const toggleOpen = (id: number) => setOpenIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  const allOpen = list.length > 0 && list.every((i) => openIds.includes(i.id))
  const toggleAll = () => setOpenIds(allOpen ? [] : list.map((i) => i.id))

  const hasImg = (n: string) => !!(imgs[nkey(n)] ?? builtin[nkey(n)])
  const names = Array.from(new Set([...items.map((i) => i.name), ...market.map((m) => m.name)]))

  // newest market note updates the market price shown on matching inventory items
  const pushLatest = (m: MItem) => {
    const l = latestOf(m)
    if (!l) return
    const k = nkey(m.name)
    setItems((cur) => cur.map((i) => (nkey(i.name) === k ? { ...i, mp: l.raw, mm: l.mode, mt: dts(l.date) } : i)))
  }

  // market price typed in the item form is also written to the price log (today)
  const logMarket = (name: string, cat: string, raw: number, mode: Mode) =>
    setMarket((cur) => {
      const k = nkey(name), ex = cur.find((m) => nkey(m.name) === k)
      const l = ex && latestOf(ex)
      if (l && l.raw === raw && l.mode === mode) return cur
      const e = { id: Date.now(), raw, mode, date: today(), note: '' }
      return ex ? cur.map((m) => (m === ex ? { ...m, entries: [...m.entries, e] } : m)) : [...cur, { id: Date.now() + 1, name, cat, entries: [e] }]
    })

  const saveM = (e: React.FormEvent) => {
    e.preventDefault()
    const raw = parseFloat(mForm.price), name = mForm.name.trim()
    if (!name || isNaN(raw)) return
    const entry = { raw, mode: mForm.mode as Mode, date: mForm.date || today(), note: mForm.note.trim() }
    let touched: MItem
    let next: MItem[]
    if (mEdit) {
      const cur = market.find((m) => m.id === mEdit.item)
      if (!cur) return
      touched = { ...cur, name, cat: mForm.cat, entries: cur.entries.map((x) => (x.id === mEdit.entry ? { ...x, ...entry } : x)) }
      next = market.map((m) => (m.id === cur.id ? touched : m))
    } else {
      const ex = market.find((m) => nkey(m.name) === nkey(name))
      if (ex) { touched = { ...ex, cat: mForm.cat, entries: [...ex.entries, { id: Date.now(), ...entry }] }; next = market.map((m) => (m === ex ? touched : m)) }
      else { touched = { id: Date.now(), name, cat: mForm.cat, entries: [{ id: Date.now() + 1, ...entry }] }; next = [...market, touched] }
    }
    setMarket(next)
    pushLatest(touched)
    setMForm({ ...mForm, price: '', note: '' })
    setMEdit(null)
    setOpen('')
  }

  const editEntry = (m: MItem, x: MEntry) => {
    setMForm({ name: m.name, cat: m.cat, price: String(x.raw), mode: x.mode, date: x.date, note: x.note })
    setMEdit({ item: m.id, entry: x.id })
    setOpen('market')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const mDelete = (key: string, run: () => void) => {
    if (mSure === key) { run(); setMSure('') }
    else { setMSure(key); setTimeout(() => setMSure((v) => (v === key ? '' : v)), 3000) }
  }

  const delEntry = (m: MItem, x: MEntry) => {
    const left = { ...m, entries: m.entries.filter((y) => y.id !== x.id) }
    setMarket(left.entries.length ? market.map((y) => (y.id === m.id ? left : y)) : market.filter((y) => y.id !== m.id))
    pushLatest(left)
    if (mEdit?.entry === x.id) setMEdit(null)
  }

  const saveImage = async (name: string, file: File) => {
    try {
      const blob = await shrink(file), key = nkey(name)
      await idbPut({ key, name, blob })
      setImgs((cur) => { if (cur[key]) URL.revokeObjectURL(cur[key].url); return { ...cur, [key]: { name, url: URL.createObjectURL(blob) } } })
      return true
    } catch { return false }
  }

  const uploadMany = async (files: FileList) => {
    let ok = 0, bad = 0
    for (const f of Array.from(files)) {
      if (await saveImage(f.name.replace(/\.[^.]+$/, ''), f)) ok++; else bad++
    }
    setImgMsg(`${ok} image${ok === 1 ? '' : 's'} saved${bad ? `, ${bad} failed` : ''}.`)
  }

  const delImage = async (key: string) => {
    try { await idbDel(key) } catch { /* ignore */ }
    setImgs((cur) => { const c = { ...cur }; if (c[key]) URL.revokeObjectURL(c[key].url); delete c[key]; return c })
  }

  // small picture box (display only)
  const thumb = (name: string) => {
    const im = imgs[nkey(name)] ?? builtin[nkey(name)]
    return <span className="thumb">{im ? <img src={im.url} alt="" draggable={false} /> : <span aria-hidden="true">?</span>}</span>
  }

  const catalog = Array.from(
    new Map([...Object.values(builtin), ...Object.values(imgs), ...market, ...items].map((x): [string, string] => [nkey(x.name), x.name])).values(),
  )

  // name input with suggestions (picture + name)
  const suggestBox = (id: string, value: string, onType: (v: string) => void, onPick: (n: string) => void) => {
    const q = nkey(value)
    const sugs = q
      ? catalog
          .filter((n) => nkey(n).includes(q) && nkey(n) !== q)
          .sort((a, b) => Number(nkey(b).startsWith(q)) - Number(nkey(a).startsWith(q)) || a.localeCompare(b))
          .slice(0, 8)
      : []
    return (
      <div className="sugwrap">
        <label>Item name
          <input
            required maxLength={60} value={value} autoComplete="off" placeholder="e.g. Climbing Vine"
            onChange={(e) => { onType(e.target.value); setSugFor(id) }}
            onFocus={() => setSugFor(id)}
            onBlur={() => setTimeout(() => setSugFor((v) => (v === id ? '' : v)), 150)}
          />
        </label>
        {sugFor === id && sugs.length > 0 && (
          <ul className="sug" role="listbox" aria-label="Suggestions">
            {sugs.map((n) => (
              <li key={n} role="option" aria-selected="false" onMouseDown={(e) => { e.preventDefault(); onPick(n); setSugFor('') }}>
                {thumb(n)}<span>{n}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // picking a suggestion in the stock form also fills category and market price if known
  const pickStock = (n: string) => {
    const m = market.find((x) => nkey(x.name) === nkey(n))
    const l = m && latestOf(m)
    setForm((f) => ({ ...f, name: n, ...(m ? { cat: m.cat } : {}), ...(l ? { market: String(l.raw), mm: l.mode } : {}) }))
  }

  // pictures for the PDF (png data, drawn at the item name)
  const loadPics = async (list: string[]) => {
    const out: Record<string, string> = {}
    for (const n of list) {
      const k = nkey(n)
      if (k in out) continue
      const im = imgs[k] ?? builtin[k]
      const d = im ? await toPng(im.url) : null
      if (d) out[k] = d
    }
    return out
  }

  const setT = (k: 'name' | 'cat' | 'header' | 'footer' | 'verb' | 'sep' | 'prices') => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setTForm((f) => ({ ...f, [k]: e.target.value }))

  const resetT = () => { setTForm(emptyT); setTEditId(null); setOpen('') }

  const saveT = (e: React.FormEvent) => {
    e.preventDefault()
    const data = { ...tForm, name: tForm.name.trim() }
    if (!data.name) return
    setTemplates(tEditId === null ? [...templates, { id: Date.now(), ...data }] : templates.map((t) => (t.id === tEditId ? { ...t, ...data } : t)))
    resetT()
  }

  const editT = (t: Template) => {
    setTForm({ name: t.name, cat: t.cat, header: t.header, footer: t.footer, verb: t.verb, sep: t.sep, prices: t.prices, stockOnly: t.stockOnly })
    setTEditId(t.id)
    setOpen('promo')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const removeT = (id: number) => {
    if (tSure === id) {
      setTemplates(templates.filter((t) => t.id !== id))
      if (tEditId === id) resetT()
      setTSure(null)
    } else {
      setTSure(id)
      setTimeout(() => setTSure((x) => (x === id ? null : x)), 3000)
    }
  }

  const copy = async (key: string, text: string) => {
    let ok = true
    try { await navigator.clipboard.writeText(text) } catch { ok = false }
    setCopied(key + (ok ? ':ok' : ':fail'))
    setTimeout(() => setCopied(''), 1800)
  }

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
      <option value="bulk">per 1 WL (e.g. 200/1)</option>
    </select>
  )

  return (
    <main>
      <header className="top">
        <h1>Vend Shop Tracker</h1>
      <nav className="tabs" aria-label="Main">
        {([['items', '📦', 'Items'], ['report', '🧾', 'Sales'], ['market', '📈', 'Market'], ['promo', '📣', 'Promo'], ['images', '🖼️', 'Images']] as const).map(([k, icon, label]) => (
          <button key={k} aria-pressed={tab === k} onClick={() => { setTab(k); window.scrollTo({ top: 0 }) }}>
            <span aria-hidden="true">{icon}</span>{label}
          </button>
        ))}
      </nav>
      </header>
      <p className="sub">Keep every item's cost (modal), sell price and stock in one place. Prices are in World Locks (WL). 100 WL = 1 DL.</p>

      {tab === 'items' && (
        <>
      <div className="sum" aria-live="polite">
        <div><b>{tot.stock}</b><span>Items in stock</span></div>
        <div><b>{wl(tot.cost)}</b><span>Money tied up (modal)</span></div>
        <div><b>{wl(tot.profit)}</b><span>Profit if all sold</span></div>
      </div>

      {open !== 'item' && <button className="pri add" onClick={() => setOpen('item')}>+ Add item</button>}
      {open === 'item' && (
      <section className="panel">
        <h2>{editId === null ? 'Add item' : 'Edit item'}</h2>
        <form onSubmit={submit} autoComplete="off">
          {suggestBox('stock', form.name, (v) => setForm((f) => ({ ...f, name: v })), pickStock)}
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
          <label>Category
            <select value={form.cat} onChange={set('cat')} aria-label="Category">
              {CATS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Market price (optional)
            <input type="number" min="0" step="any" value={form.market} onChange={set('market')} placeholder="Price right now" />
            {modeSelect('mm')}
          </label>
          <label className="note">Note (optional)
            <input maxLength={120} value={form.note} onChange={set('note')} placeholder="Where you bought it, vend world, etc." />
          </label>
          <label className="chk">
            <input type="checkbox" checked={form.showPrice} onChange={(e) => setForm((f) => ({ ...f, showPrice: e.target.checked }))} />
            Show this item's price in Discord promo
          </label>
          <div className="preview">{preview}</div>
          <div className="btns">
            <button className="pri" type="submit">{editId === null ? 'Add item' : 'Save changes'}</button>
            <button type="button" onClick={reset}>Cancel</button>
          </div>
        </form>
      </section>
      )}

      <div className="tools">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items" aria-label="Search items" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort items">
          <option value="new">Newest first</option>
          <option value="name">Name A-Z</option>
          <option value="profit">Highest profit</option>
          <option value="price">Highest sell price</option>
          <option value="cat">Category</option>
        </select>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} aria-label="Filter by category">
          <option value="all">All categories</option>
          {CATS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button className="pri" onClick={exportItemsPdf}>Download PDF</button>
        <button onClick={exportItems}>CSV</button>
      </div>

      {list.length === 0 && (
        <div className="empty">{items.length ? 'No items match your search.' : 'No items yet. Add your first item above.'}</div>
      )}
      {list.length > 0 && (
        <div className="listbar">
          <span>{list.length} item{list.length === 1 ? '' : 's'}</span>
          <button className="sm" onClick={toggleAll}>{allOpen ? 'Collapse all' : 'Expand all'}</button>
        </div>
      )}
      <div className="itemlist">
      {list.map((i) => {
        const isOpen = openIds.includes(i.id)
        const pe = profitEach(i)
        const mkt = i.mp === undefined ? null : per(i.mp, i.mm ?? 'each')
        const md = mkt && mkt > 0 ? Math.round((per(i.pr, i.pm) / mkt - 1) * 100) : null
        const margin = i.cr > 0 ? Math.round((pe / per(i.cr, i.cm)) * 100) : null
        return (
          <div key={i.id} className={`item${i.qty === 0 ? ' out' : ''}${isOpen ? ' open' : ''}`}>
            <button className="ihead" aria-expanded={isOpen} onClick={() => toggleOpen(i.id)}>
              {thumb(i.name)}
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
                  <input className="sq" type="number" min="1" max={i.qty} value={sold[i.id] ?? '1'} disabled={i.qty === 0}
                    onChange={(e) => setSold({ ...sold, [i.id]: e.target.value })} aria-label="Quantity sold" />
                  <button className="sm" disabled={i.qty === 0} onClick={() => sell(i)}>Sold</button>
                  <button className="sm" onClick={() => edit(i)}>Edit</button>
                  <button className="sm del" onClick={() => remove(i.id)}>{sure === i.id ? 'Confirm delete' : 'Delete'}</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
      </div>
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
      {tab === 'promo' && (
        <>
          {open !== 'promo' && <button className="pri add" onClick={() => setOpen('promo')}>+ New template</button>}
          {open === 'promo' && (
          <section className="panel">
            <h2>{tEditId === null ? 'New promo template' : 'Edit template'}</h2>
            <form onSubmit={saveT} autoComplete="off" className="tform">
              <label>Template name
                <input required maxLength={40} value={tForm.name} onChange={setT('name')} placeholder="e.g. Block server" />
              </label>
              <label>Items from category
                <select value={tForm.cat} onChange={setT('cat')}>
                  <option value="all">All categories</option>
                  {CATS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label>Header text
                <input value={tForm.header} onChange={setT('header')} placeholder="SELL AT QLOUN" />
              </label>
              <label>Footer text
                <input value={tForm.footer} onChange={setT('footer')} placeholder="SELL AT QLOUN" />
              </label>
              <label>Word before each item
                <input value={tForm.verb} onChange={setT('verb')} placeholder="Sell" />
              </label>
              <label>Separator
                <input value={tForm.sep} onChange={setT('sep')} placeholder=" | " />
              </label>
              <label>Prices
                <select value={tForm.prices} onChange={setT('prices')}>
                  <option value="marked">Only items marked "Show price"</option>
                  <option value="all">All items</option>
                  <option value="none">No prices</option>
                </select>
              </label>
              <label className="chk">
                <input type="checkbox" checked={tForm.stockOnly} onChange={(e) => setTForm((f) => ({ ...f, stockOnly: e.target.checked }))} />
                Only items that are in stock
              </label>
              <div className="btns">
                <button className="pri" type="submit">{tEditId === null ? 'Add template' : 'Save changes'}</button>
                <button type="button" onClick={resetT}>Cancel</button>
              </div>
            </form>
          </section>
          )}

          {templates.length === 0 && <div className="empty">No templates yet. Make one for each Discord server, then copy and paste.</div>}
          <div className="cards">
          {templates.map((t) => {
            const r = buildPromo(t, items)
            return (
              <section className="panel" key={t.id}>
                <h2>{t.name}<small>{t.cat === 'all' ? 'All categories' : t.cat} - {r.count} items - {r.msgs.length} message{r.msgs.length === 1 ? '' : 's'}</small></h2>
                {r.msgs.length === 0 && <p className="sub">No items match this template yet.</p>}
                {r.msgs.map((m, k) => {
                  const key = `${t.id}-${k}`
                  return (
                    <div className="msg" key={k}>
                      <textarea readOnly rows={6} value={m} onFocus={(e) => e.currentTarget.select()} aria-label={`Message ${k + 1}`} />
                      <div className="mrow">
                        <span>{r.msgs.length > 1 ? `Message ${k + 1} of ${r.msgs.length} - ` : ''}{m.length} / 2000 characters</span>
                        <button className="pri sm" onClick={() => copy(key, m)}>
                          {copied === key + ':ok' ? 'Copied!' : copied === key + ':fail' ? 'Copy failed, select the text' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )
                })}
                <div className="btns">
                  <button className="sm" onClick={() => editT(t)}>Edit</button>
                  <button className="sm" onClick={() => setTemplates([...templates, { ...t, id: Date.now(), name: `${t.name} (copy)` }])}>Duplicate</button>
                  <button className="sm del" onClick={() => removeT(t.id)}>{tSure === t.id ? 'Confirm delete' : 'Delete'}</button>
                </div>
              </section>
            )
          })}
          </div>
        </>
      )}
      {tab === 'market' && (
        <>
          {open !== 'market' && <button className="pri add" onClick={() => setOpen('market')}>+ Add price note</button>}
          {open === 'market' && (
          <section className="panel">
            <h2>{mEdit ? 'Edit price note' : 'Add price note'}</h2>
            <form onSubmit={saveM} autoComplete="off" className="tform">
              {suggestBox('market', mForm.name, (v) => setMForm({ ...mForm, name: v }), (n) => setMForm({ ...mForm, name: n }))}
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
                <button type="button" onClick={() => { setMEdit(null); setMForm({ ...mForm, price: '', note: '' }); setOpen('') }}>Cancel</button>
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
                    {thumb(m.name)}
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
                        <button className="sm del" onClick={() => mDelete(`e${x.id}`, () => delEntry(m, x))}>{mSure === `e${x.id}` ? 'Confirm' : 'Delete'}</button>
                      </div>
                    ))}
                  </details>
                  <div className="btns">
                    <button className="sm" onClick={() => { setMEdit(null); setOpen('market'); setMForm({ name: m.name, cat: m.cat, price: '', mode: cur.mode, date: today(), note: '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>New price</button>
                    <button className="sm del" onClick={() => mDelete(`m${m.id}`, () => setMarket(market.filter((y) => y.id !== m.id)))}>{mSure === `m${m.id}` ? 'Confirm delete' : 'Delete item'}</button>
                  </div>
                </section>
              )
            })}
          </div>
        </>
      )}

      {tab === 'images' && (
        <>
          <section className="panel">
            <h2>Item images</h2>
            <p className="sub">Pick many images at once. The file name must match the item name, for example "Climbing Vine.png" (not case sensitive). Every image is shared by Items and Market. Some images come built in with the app; an image you upload replaces the built-in one for that item.</p>
            <input type="file" accept="image/*" multiple onChange={(e) => { if (e.target.files) uploadMany(e.target.files); e.target.value = '' }} aria-label="Upload images" />
            {imgMsg && <p className="sub" role="status">{imgMsg}</p>}
          </section>
          {names.filter((n) => !hasImg(n)).length > 0 && (
            <section className="panel">
              <h2>Items without image<small>upload a file with the same name</small></h2>
              <div className="igrid">
                {names.filter((n) => !hasImg(n)).map((n) => <div className="icell" key={n}>{thumb(n)}<span>{n}</span></div>)}
              </div>
            </section>
          )}
          <section className="panel">
            <h2>Library<small>{Object.keys({ ...builtin, ...imgs }).length} images</small></h2>
            {Object.keys({ ...builtin, ...imgs }).length === 0 && <p className="sub">No images yet.</p>}
            <div className="igrid">
              {Object.entries({ ...builtin, ...imgs }).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([k, v]) => (
                <div className="icell" key={k}>
                  {thumb(v.name)}<span>{v.name}</span>
                  {imgs[k]
                    ? <button className="sm del" onClick={() => mDelete(`i${k}`, () => delImage(k))}>{mSure === `i${k}` ? 'Confirm' : builtin[k] ? 'Reset to built-in' : 'Delete'}</button>
                    : <small>built-in</small>}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
