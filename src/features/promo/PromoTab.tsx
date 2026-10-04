import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { CATS, EMPTY_TEMPLATE } from '../../constants'
import { useConfirm } from '../../hooks/useConfirm'
import { buildPromo } from '../../lib/promo'
import { useShop } from '../../store/ShopContext'
import type { TForm, Template } from '../../types'

export default function PromoTab() {
  const { items, templates, saveTemplate, removeTemplate, duplicateTemplate } = useShop()
  const [tForm, setTForm] = useState<TForm>(EMPTY_TEMPLATE)
  const [tEditId, setTEditId] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState('')
  const { armed, ask } = useConfirm()

  const setT = (k: 'name' | 'cat' | 'header' | 'footer' | 'verb' | 'sep' | 'prices') => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setTForm((f) => ({ ...f, [k]: e.target.value }))

  const resetT = () => { setTForm(EMPTY_TEMPLATE); setTEditId(null); setOpen(false) }

  const saveT = (e: FormEvent) => {
    e.preventDefault()
    const name = tForm.name.trim()
    if (!name) return
    saveTemplate({ ...tForm, name }, tEditId)
    resetT()
  }

  const editT = (t: Template) => {
    setTForm({ name: t.name, cat: t.cat, header: t.header, footer: t.footer, verb: t.verb, sep: t.sep, prices: t.prices, stockOnly: t.stockOnly })
    setTEditId(t.id)
    setOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const copy = async (key: string, text: string) => {
    let ok = true
    try { await navigator.clipboard.writeText(text) } catch { ok = false }
    setCopied(key + (ok ? ':ok' : ':fail'))
    setTimeout(() => setCopied(''), 1800)
  }

  return (
    <>
      {!open && <button className="pri add" onClick={() => setOpen(true)}>+ New template</button>}
      {open && (
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
              <button className="sm" onClick={() => duplicateTemplate(t)}>Duplicate</button>
              <button className="sm del" onClick={() => ask(t.id, () => removeTemplate(t.id))}>{armed === t.id ? 'Confirm delete' : 'Delete'}</button>
            </div>
          </section>
        )
      })}
      </div>
    </>
  )
}
