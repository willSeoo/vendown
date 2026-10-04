/** Money helpers. 1 DL = 100 WL; "bulk" prices mean N items for 1 WL (e.g. 200/1). */
import type { Item, Mode } from '../types'

// bulk "200/1" means 200 items for 1 WL, so one item costs 1/200 WL
export const per = (raw: number, m: Mode) => (isNaN(raw) ? NaN : m === 'bulk' ? (raw > 0 ? 1 / raw : 0) : raw)

export const wl = (v: number) => {
  const r = Math.round(v), a = Math.abs(r)
  let s = `${r} WL`
  if (a >= 100) s += ` (${r < 0 ? '-' : ''}${Math.floor(a / 100)} DL${a % 100 ? ` ${a % 100} WL` : ''})`
  return s
}

export const shown = (raw: number, m: Mode) => (m === 'bulk' ? `${raw} / 1 WL` : wl(raw))

export const profitEach = (i: Item) => per(i.pr, i.pm) - per(i.cr, i.cm)

// price as written in Discord: "2/1" for bulk, "3 WL", "2 DL"
export const promoPrice = (i: Item) => {
  if (i.pm === 'bulk') return `${i.pr}/1`
  const v = Math.round(i.pr)
  return v >= 100 && v % 100 === 0 ? `${v / 100} DL` : `${v} WL`
}

// per-item price; tiny bulk values shown as "200 / 1 WL"
export const each = (v: number) => (v > 0 && v < 1 ? `${Math.round(1 / v)} / 1 WL` : wl(v))

export const u4 = (v: number) => Math.round(v * 10000) / 10000
