/** Discord promo text builder. */
import { promoPrice } from './money'
import { catOf } from './names'
import type { Item, TForm } from '../types'

// build the Discord messages (max 2000 characters each; header and footer repeat in every message)
export const buildPromo = (t: TForm, all: Item[]) => {
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
