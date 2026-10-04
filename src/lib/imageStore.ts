/** Browser image storage (IndexedDB) and image helpers. */
import type { ImgRec } from '../types'

// images live in IndexedDB (too big for localStorage)
export const idb = () => new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open('vend-shop', 1)
  r.onupgradeneeded = () => r.result.createObjectStore('img', { keyPath: 'key' })
  r.onsuccess = () => res(r.result)
  r.onerror = () => rej(r.error)
})

export const idbAll = async () => {
  const db = await idb()
  return new Promise<ImgRec[]>((res, rej) => { const q = db.transaction('img').objectStore('img').getAll(); q.onsuccess = () => res(q.result as ImgRec[]); q.onerror = () => rej(q.error) })
}

export const idbPut = async (rec: ImgRec) => {
  const db = await idb()
  return new Promise<void>((res, rej) => { const t = db.transaction('img', 'readwrite'); t.objectStore('img').put(rec); t.oncomplete = () => res(); t.onerror = () => rej(t.error) })
}

export const idbDel = async (key: string) => {
  const db = await idb()
  return new Promise<void>((res, rej) => { const t = db.transaction('img', 'readwrite'); t.objectStore('img').delete(key); t.oncomplete = () => res(); t.onerror = () => rej(t.error) })
}

// shrink big pictures so storage stays small
export const shrink = async (file: File, max = 160): Promise<Blob> => {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k))
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('image'))), 'image/webp', 0.85))
}

// any picture (webp etc.) to a crisp png data URL for the PDF
export const toPng = (url: string) => new Promise<string | null>((res) => {
  const im = new Image()
  im.onload = () => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const x = c.getContext('2d')!
    x.imageSmoothingEnabled = false
    const k = Math.min(64 / im.width, 64 / im.height), w = im.width * k, h = im.height * k
    x.drawImage(im, (64 - w) / 2, (64 - h) / 2, w, h)
    res(c.toDataURL('image/png'))
  }
  im.onerror = () => res(null)
  im.src = url
})
