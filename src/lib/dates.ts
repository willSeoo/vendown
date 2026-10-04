/** Date helpers. */
import { MONTHS } from '../constants'

export const pad = (n: number) => String(n).padStart(2, '0')

export const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

export const dts = (d: string) => new Date(d + 'T12:00:00').getTime()

export const dlabel = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export const stamp = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}` }

export const dstr = (t: number) => { const d = new Date(t); return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}` }
