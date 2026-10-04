import { useState, useMemo } from 'react'
import ItemCard from './ItemCard'
import ItemForm from './ItemForm'
import { CATS } from '../../constants'
import { downloadItemsCsv } from '../../lib/csv'
import { wl } from '../../lib/money'
import { downloadItemsPdf } from '../../lib/pdf'
import { totalsOf, visibleItems } from '../../lib/summary'
import { useShop } from '../../store/ShopContext'
import type { Item } from '../../types'

export default function ItemsTab() {
  const { items, removeItem, images } = useShop()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('new')
  const [catFilter, setCatFilter] = useState('all')
  const [openIds, setOpenIds] = useState<number[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)

  const list = useMemo(() => visibleItems(items, q, sort, catFilter), [items, q, sort, catFilter])
  const tot = useMemo(() => totalsOf(items), [items])

  const toggleOpen = (id: number) => setOpenIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  const allOpen = list.length > 0 && list.every((i) => openIds.includes(i.id))
  const toggleAll = () => setOpenIds(allOpen ? [] : list.map((i) => i.id))

  const exportItems = () => downloadItemsCsv(items, tot)
  const exportItemsPdf = () => downloadItemsPdf(items, tot, images.loadPics)

  const openForm = (item: Item | null) => {
    setEditing(item)
    setFormOpen(true)
    if (item) window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const closeForm = () => { setEditing(null); setFormOpen(false) }

  return (
    <>
      <div className="sum" aria-live="polite">
        <div><b>{tot.stock}</b><span>Items in stock</span></div>
        <div><b>{wl(tot.cost)}</b><span>Money tied up (modal)</span></div>
        <div><b>{wl(tot.profit)}</b><span>Profit if all sold</span></div>
      </div>

      {!formOpen && <button className="pri add" onClick={() => openForm(null)}>+ Add item</button>}
      {formOpen && <ItemForm key={editing?.id ?? 'new'} item={editing} onDone={closeForm} />}

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
        {list.map((i) => (
          <ItemCard
            key={i.id}
            item={i}
            open={openIds.includes(i.id)}
            onToggle={() => toggleOpen(i.id)}
            onEdit={() => openForm(i)}
            onDelete={(id) => { removeItem(id); if (editing?.id === id) closeForm() }}
          />
        ))}
      </div>
      <p className="sub" style={{ marginTop: 16 }}>Your items are saved in this browser on this device only.</p>
    </>
  )
}
