import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import ModeSelect from '../../components/ModeSelect'
import NameSuggest from '../../components/NameSuggest'
import { CATS, EMPTY_FORM } from '../../constants'
import { latestOf } from '../../lib/market'
import { per, wl } from '../../lib/money'
import { catOf, nkey } from '../../lib/names'
import { useShop } from '../../store/ShopContext'
import type { Form, Item, Mode } from '../../types'

type Props = { item: Item | null; onDone: () => void }

const itemToForm = (i: Item): Form => ({ name: i.name, cost: String(i.cr), price: String(i.pr), qty: String(i.qty), note: i.note, cm: i.cm, pm: i.pm, market: i.mp === undefined ? '' : String(i.mp), mm: i.mm ?? 'each', cat: catOf(i), showPrice: !!i.showPrice })

/** Add / edit form. Remount it (key) to load another item. */
export default function ItemForm({ item, onDone }: Props) {
  const { market, saveItem } = useShop()
  const editId = item?.id ?? null
  const [form, setForm] = useState<Form>(() => (item ? itemToForm(item) : EMPTY_FORM))

  const set = (k: Exclude<keyof Form, 'showPrice'>) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const cr = parseFloat(form.cost), pr = parseFloat(form.price), qty = parseInt(form.qty, 10)
    if (!form.name.trim() || isNaN(cr) || isNaN(pr) || isNaN(qty)) return
    const mpv = parseFloat(form.market)
    saveItem(
      {
        name: form.name.trim(), note: form.note.trim(), qty, cr, pr,
        cm: form.cm as Mode, pm: form.pm as Mode,
        mp: isNaN(mpv) ? undefined : mpv, mm: form.mm as Mode,
        cat: form.cat, showPrice: form.showPrice,
      },
      editId,
    )
    onDone()
  }

  // picking a suggestion in the stock form also fills category and market price if known
  const pickStock = (n: string) => {
    const m = market.find((x) => nkey(x.name) === nkey(n))
    const l = m && latestOf(m)
    setForm((f) => ({ ...f, name: n, ...(m ? { cat: m.cat } : {}), ...(l ? { market: String(l.raw), mm: l.mode } : {}) }))
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

  return (
    <section className="panel">
      <h2>{editId === null ? 'Add item' : 'Edit item'}</h2>
      <form onSubmit={submit} autoComplete="off">
        <NameSuggest value={form.name} onType={(v) => setForm((f) => ({ ...f, name: v }))} onPick={pickStock} />
        <label>Modal
          <input type="number" min="0" step="any" required value={form.cost} onChange={set('cost')} placeholder="0" />
          <ModeSelect label="Modal type" value={form.cm} onChange={set('cm')} />
        </label>
        <label>Sell price
          <input type="number" min="0" step="any" required value={form.price} onChange={set('price')} placeholder="0" />
          <ModeSelect label="Sell price type" value={form.pm} onChange={set('pm')} />
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
          <ModeSelect label="Market price type" value={form.mm} onChange={set('mm')} />
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
          <button type="button" onClick={onDone}>Cancel</button>
        </div>
      </form>
    </section>
  )
}
