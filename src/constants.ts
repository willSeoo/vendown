/** localStorage keys (kept identical to earlier versions so saved data keeps working). */
import type { Form, TForm } from './types'

export const STORAGE_KEYS = {
  items: 'vend-items-v1',
  sales: 'vend-sales-v1',
  market: 'vend-market-v1',
  templates: 'vend-templates-v1',
} as const

export const CATS = ['Block', 'Background', 'Consumable', 'Surgery', 'Clothing', 'Seed', 'Item', 'Other']

export const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export const RANGES: Record<string, string> = { today: 'Today', '7': 'Last 7 days', '30': 'Last 30 days', all: 'All time' }

export const EMPTY_FORM: Form = { name: '', cost: '', price: '', qty: '1', note: '', cm: 'each', pm: 'each', market: '', mm: 'each', cat: 'Item', showPrice: false }

export const EMPTY_TEMPLATE: TForm = { name: '', cat: 'Block', header: 'SELL AT QLOUN', footer: 'SELL AT QLOUN', verb: 'Sell', sep: ' | ', prices: 'marked', stockOnly: true }
