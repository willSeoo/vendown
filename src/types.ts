
export type Mode = 'each' | 'bulk'

export type Item = { id: number; name: string; note: string; qty: number; cr: number; pr: number; cm: Mode; pm: Mode; mp?: number; mm?: Mode; mt?: number; cat?: string; showPrice?: boolean }

export type Sale = { id: number; itemId: number; name: string; qty: number; revenue: number; cost: number; ts: number; mk?: number; cat?: string }

export type Form = { name: string; cost: string; price: string; qty: string; note: string; cm: string; pm: string; market: string; mm: string; cat: string; showPrice: boolean }

export type Template = { id: number; name: string; cat: string; header: string; footer: string; verb: string; sep: string; prices: 'none' | 'all' | 'marked'; stockOnly: boolean }

export type TForm = Omit<Template, 'id'>

export type MEntry = { id: number; raw: number; mode: Mode; date: string; note: string }

export type MItem = { id: number; name: string; cat: string; entries: MEntry[] }

export type ImgRec = { key: string; name: string; blob: Blob }

export type PdfTable = { imgNames?: string[]; imgCol?: number; title?: string; head: string[]; body: (string | number)[][]; foot?: (string | number)[] }

export type Tab = 'items' | 'report' | 'market' | 'promo' | 'images'
export type ImageEntry = { name: string; url: string }
export type Totals = { stock: number; cost: number; profit: number }
/** What the item form hands to the store (id and market timestamp are added there). */
export type ItemInput = Omit<Item, 'id' | 'mt' | 'cat' | 'mm'> & { cat: string; mm: Mode }
export type MarketInput = { name: string; cat: string; raw: number; mode: Mode; date: string; note: string }
export type MarketEdit = { item: number; entry: number }
export type LoadPics = (names: string[]) => Promise<Record<string, string>>
