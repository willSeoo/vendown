/** Totals, filtering and the sales report (pure functions). */
import { CATS } from '../constants'
import { per, profitEach } from './money'
import { catOf } from './names'
import type { Item, Sale, Totals } from '../types'

export const totalsOf = (items: Item[]): Totals =>
  items.reduce(
    (t, i) => ({ stock: t.stock + i.qty, cost: t.cost + per(i.cr, i.cm) * i.qty, profit: t.profit + profitEach(i) * i.qty }),
    { stock: 0, cost: 0, profit: 0 },
  )

export const visibleItems = (items: Item[], q: string, sort: string, catFilter: string): Item[] => {
  const v = items.filter((i) => (catFilter === 'all' || catOf(i) === catFilter) && (!q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase())))
  return v.sort((a, b) =>
    sort === 'cat' ? CATS.indexOf(catOf(a)) - CATS.indexOf(catOf(b)) || a.name.localeCompare(b.name)
    : sort === 'name' ? a.name.localeCompare(b.name)
    : sort === 'profit' ? profitEach(b) - profitEach(a)
    : sort === 'price' ? per(b.pr, b.pm) - per(a.pr, a.pm)
    : b.id - a.id)
}

export const salesReport = (sales: Sale[], range: string) => {
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
}

export type Report = ReturnType<typeof salesReport>
