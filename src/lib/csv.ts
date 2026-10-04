/** CSV downloads (open in Excel / Google Sheets). */
import { MONTHS } from '../constants'
import { dstr, stamp } from './dates'
import { per, u4 } from './money'
import { catOf } from './names'
import type { Item, Totals } from '../types'
import type { Report } from './summary'

// download rows as a CSV file (opens in Excel / Google Sheets)
export const download = (name: string, rows: (string | number)[][]) => {
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

export const downloadItemsCsv = (items: Item[], tot: Totals) =>
  download(`items-vend-${stamp()}.csv`, [
    ['Item', 'Note', 'Stock', 'Modal (input)', 'Modal type', 'Modal per item (WL)', 'Sell (input)', 'Sell type', 'Sell per item (WL)', 'Profit per item (WL)', 'Margin %', 'Stock value at modal (WL)', 'Profit if all sold (WL)', 'Market price (input)', 'Market type', 'Market per item (WL)', 'Sell vs market %', 'Market price updated', 'Category'],
    ...items.map((i) => {
      const c1 = per(i.cr, i.cm), p1 = per(i.pr, i.pm), mkv = i.mp === undefined ? undefined : per(i.mp, i.mm ?? 'each')
      return [i.name, i.note, i.qty, i.cr, i.cm === 'bulk' ? 'items per 1 WL' : 'WL each', u4(c1), i.pr, i.pm === 'bulk' ? 'items per 1 WL' : 'WL each', u4(p1), u4(p1 - c1), c1 > 0 ? Math.round(((p1 - c1) / c1) * 100) : '', Math.round(c1 * i.qty), Math.round((p1 - c1) * i.qty), i.mp ?? '', i.mp === undefined ? '' : i.mm === 'bulk' ? 'items per 1 WL' : 'WL each', mkv === undefined ? '' : u4(mkv), mkv && mkv > 0 ? Math.round((p1 / mkv - 1) * 100) : '', i.mt ? dstr(i.mt) : '', catOf(i)]
    }),
    ['TOTAL', '', tot.stock, '', '', '', '', '', '', '', '', Math.round(tot.cost), Math.round(tot.profit), '', '', '', '', '', ''],
  ])

export const downloadSalesCsv = (rep: Report, items: Item[]) =>
  download(`sales-vend-${stamp()}.csv`, [
    ['Date', 'Time', 'Item', 'Qty', 'Sell per item (WL)', 'Total sales (WL)', 'Total modal (WL)', 'Profit (WL)', 'Market per item at sale (WL)', 'Category'],
    ...rep.list.map((x) => {
      const d = new Date(x.ts)
      return [`${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`, d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), x.name, x.qty, u4(x.revenue / x.qty), Math.round(x.revenue), Math.round(x.cost), Math.round(x.revenue - x.cost), x.mk === undefined ? '' : u4(x.mk), x.cat ?? items.find((i) => i.id === x.itemId)?.cat ?? 'Other']
    }),
    ['TOTAL', '', '', rep.units, '', Math.round(rep.revenue), Math.round(rep.cost), Math.round(rep.profit), '', ''],
  ])
