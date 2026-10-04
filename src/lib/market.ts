/** Market price notes (pure functions, no React). */
import { dts, today } from './dates'
import { nkey } from './names'
import type { Item, MEntry, MItem, Mode } from '../types'

export const latestOf = (m: MItem) => m.entries.reduce<MEntry | undefined>((a, e) => (!a || e.date >= a.date ? e : a), undefined)

/** Newest note wins: copy its price onto matching inventory items. */
export const applyLatestToItems = (items: Item[], m: MItem): Item[] => {
  const l = latestOf(m)
  if (!l) return items
  const k = nkey(m.name)
  return items.map((i) => (nkey(i.name) === k ? { ...i, mp: l.raw, mm: l.mode, mt: dts(l.date) } : i))
}

/** Add a dated price note (used when a market price is typed into the item form). */
export const addMarketLog = (market: MItem[], name: string, cat: string, raw: number, mode: Mode): MItem[] => {
  const k = nkey(name), ex = market.find((m) => nkey(m.name) === k)
  const l = ex && latestOf(ex)
  if (l && l.raw === raw && l.mode === mode) return market
  const e = { id: Date.now(), raw, mode, date: today(), note: '' }
  return ex ? market.map((m) => (m === ex ? { ...m, entries: [...m.entries, e] } : m)) : [...market, { id: Date.now() + 1, name, cat, entries: [e] }]
}
