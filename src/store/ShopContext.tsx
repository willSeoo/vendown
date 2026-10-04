/** One place for the shop data (items, sales, market notes, templates, pictures) and the actions that change it. */
import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { STORAGE_KEYS } from '../constants'
import { useImages } from '../hooks/useImages'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { addMarketLog, applyLatestToItems } from '../lib/market'
import { per } from '../lib/money'
import { catOf, nkey } from '../lib/names'
import type { ImagesApi } from '../hooks/useImages'
import type { Item, ItemInput, MEntry, MItem, MarketEdit, MarketInput, Sale, TForm, Template } from '../types'

type ShopApi = {
  items: Item[]
  sales: Sale[]
  market: MItem[]
  templates: Template[]
  images: ImagesApi
  saveItem: (d: ItemInput, editId: number | null) => void
  removeItem: (id: number) => void
  sellItem: (i: Item, qty: number) => void
  undoSale: (s: Sale) => void
  saveMarketEntry: (input: MarketInput, edit: MarketEdit | null) => boolean
  deleteMarketEntry: (m: MItem, x: MEntry) => void
  deleteMarketItem: (id: number) => void
  saveTemplate: (data: TForm, editId: number | null) => void
  removeTemplate: (id: number) => void
  duplicateTemplate: (t: Template) => void
}

const ShopContext = createContext<ShopApi | null>(null)

export function ShopProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useLocalStorage<Item[]>(STORAGE_KEYS.items, [])
  const [sales, setSales] = useLocalStorage<Sale[]>(STORAGE_KEYS.sales, [])
  const [market, setMarket] = useLocalStorage<MItem[]>(STORAGE_KEYS.market, [])
  const [templates, setTemplates] = useLocalStorage<Template[]>(STORAGE_KEYS.templates, [])
  const images = useImages()

  // ---- inventory
  const saveItem = (d: ItemInput, editId: number | null) => {
    const prev = items.find((i) => i.id === editId)
    const changed = d.mp !== undefined && (!prev || prev.mp !== d.mp || prev.mm !== d.mm)
    const mt = d.mp === undefined ? undefined : changed ? Date.now() : prev?.mt
    if (changed) setMarket((cur) => addMarketLog(cur, d.name, d.cat, d.mp as number, d.mm))
    setItems(editId === null ? [...items, { id: Date.now(), ...d, mt }] : items.map((i) => (i.id === editId ? { ...i, ...d, mt } : i)))
  }

  const removeItem = (id: number) => setItems((cur) => cur.filter((i) => i.id !== id))

  const sellItem = (i: Item, qty: number) => {
    setItems((cur) => cur.map((x) => (x.id === i.id ? { ...x, qty: x.qty - qty } : x)))
    setSales((cur) => [
      { id: Date.now(), itemId: i.id, name: i.name, qty, revenue: per(i.pr, i.pm) * qty, cost: per(i.cr, i.cm) * qty, ts: Date.now(), mk: i.mp === undefined ? undefined : per(i.mp, i.mm ?? 'each'), cat: catOf(i) },
      ...cur,
    ])
  }

  // undo a recorded sale and put the stock back
  const undoSale = (s: Sale) => {
    setSales((cur) => cur.filter((x) => x.id !== s.id))
    setItems((cur) => cur.map((i) => (i.id === s.itemId ? { ...i, qty: i.qty + s.qty } : i)))
  }

  // ---- market price notes
  const saveMarketEntry = (input: MarketInput, edit: MarketEdit | null) => {
    const { name, cat, raw, mode, date, note } = input
    const entry = { raw, mode, date, note }
    let touched: MItem
    let next: MItem[]
    if (edit) {
      const cur = market.find((m) => m.id === edit.item)
      if (!cur) return false
      touched = { ...cur, name, cat, entries: cur.entries.map((x) => (x.id === edit.entry ? { ...x, ...entry } : x)) }
      next = market.map((m) => (m.id === cur.id ? touched : m))
    } else {
      const ex = market.find((m) => nkey(m.name) === nkey(name))
      if (ex) { touched = { ...ex, cat, entries: [...ex.entries, { id: Date.now(), ...entry }] }; next = market.map((m) => (m === ex ? touched : m)) }
      else { touched = { id: Date.now(), name, cat, entries: [{ id: Date.now() + 1, ...entry }] }; next = [...market, touched] }
    }
    setMarket(next)
    setItems((cur) => applyLatestToItems(cur, touched))
    return true
  }

  const deleteMarketEntry = (m: MItem, x: MEntry) => {
    const left = { ...m, entries: m.entries.filter((y) => y.id !== x.id) }
    setMarket(left.entries.length ? market.map((y) => (y.id === m.id ? left : y)) : market.filter((y) => y.id !== m.id))
    setItems((cur) => applyLatestToItems(cur, left))
  }

  const deleteMarketItem = (id: number) => setMarket((cur) => cur.filter((y) => y.id !== id))

  // ---- promo templates
  const saveTemplate = (data: TForm, editId: number | null) =>
    setTemplates(editId === null ? [...templates, { id: Date.now(), ...data }] : templates.map((t) => (t.id === editId ? { ...t, ...data } : t)))

  const removeTemplate = (id: number) => setTemplates((cur) => cur.filter((t) => t.id !== id))

  const duplicateTemplate = (t: Template) => setTemplates((cur) => [...cur, { ...t, id: Date.now(), name: `${t.name} (copy)` }])

  const value: ShopApi = {
    items, sales, market, templates, images,
    saveItem, removeItem, sellItem, undoSale,
    saveMarketEntry, deleteMarketEntry, deleteMarketItem,
    saveTemplate, removeTemplate, duplicateTemplate,
  }
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}

export function useShop(): ShopApi {
  const ctx = useContext(ShopContext)
  if (!ctx) throw new Error('useShop must be used inside <ShopProvider>')
  return ctx
}
