/** PDF downloads (jsPDF is loaded only when a PDF is requested). */
import { CATS, RANGES } from '../constants'
import { dstr, stamp } from './dates'
import { each, per, profitEach, shown, wl } from './money'
import { catOf, nkey } from './names'
import type { Item, LoadPics, PdfTable, Sale, Totals } from '../types'
import type { Report } from './summary'

// build and save a PDF (loaded on demand so the app starts fast)
export const makePdf = async (name: string, title: string, lines: string[], tables: PdfTable[], pics: Record<string, string> = {}) => {
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

export const downloadItemsPdf = async (items: Item[], tot: Totals, loadPics: LoadPics) => {
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

export const downloadSalesPdf = async (rep: Report, items: Item[], range: string, loadPics: LoadPics) => {
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
