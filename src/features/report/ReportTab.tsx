import { useState, useMemo } from 'react'
import { downloadSalesCsv } from '../../lib/csv'
import { each, wl } from '../../lib/money'
import { downloadSalesPdf } from '../../lib/pdf'
import { salesReport } from '../../lib/summary'
import { useShop } from '../../store/ShopContext'

export default function ReportTab() {
  const { items, sales, undoSale: undo, images } = useShop()
  const [range, setRange] = useState('7')
  const rep = useMemo(() => salesReport(sales, range), [sales, range])
  const exportSales = () => downloadSalesCsv(rep, items)
  const exportSalesPdf = () => downloadSalesPdf(rep, items, range, images.loadPics)

  return (
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
  )
}
