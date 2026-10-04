/** Item pictures: built-in ones shipped in /items plus ones uploaded by the user (kept in IndexedDB). */
import { useState, useEffect } from 'react'
import { idbAll, idbDel, idbPut, shrink, toPng } from '../lib/imageStore'
import { nkey } from '../lib/names'
import type { ImageEntry } from '../types'

export function useImages() {
  const [imgs, setImgs] = useState<Record<string, ImageEntry>>({})
  const [builtin, setBuiltin] = useState<Record<string, ImageEntry>>({})
  const [imgMsg, setImgMsg] = useState('')

  // pictures shipped with the app in public/items (listed in public/items/index.json)
  useEffect(() => {
    const base = import.meta.env.BASE_URL
    fetch(`${base}items/index.json`)
      .then((r) => r.json())
      .then((list: string[]) => {
        const m: Record<string, { name: string; url: string }> = {}
        list.forEach((f) => { const name = f.replace(/\.[^.]+$/, ''); m[nkey(name)] = { name, url: `${base}items/${encodeURIComponent(f)}` } })
        setBuiltin(m)
      })
      .catch(() => { /* no built-in pictures */ })
  }, [])

  useEffect(() => {
    idbAll().then((recs) => {
      const m: Record<string, { name: string; url: string }> = {}
      recs.forEach((r) => { m[r.key] = { name: r.name, url: URL.createObjectURL(r.blob) } })
      setImgs(m)
    }).catch(() => setImgMsg('Images cannot be saved in this browser mode.'))
  }, [])

  const saveImage = async (name: string, file: File) => {
    try {
      const blob = await shrink(file), key = nkey(name)
      await idbPut({ key, name, blob })
      setImgs((cur) => { if (cur[key]) URL.revokeObjectURL(cur[key].url); return { ...cur, [key]: { name, url: URL.createObjectURL(blob) } } })
      return true
    } catch { return false }
  }

  const uploadMany = async (files: FileList) => {
    let ok = 0, bad = 0
    for (const f of Array.from(files)) {
      if (await saveImage(f.name.replace(/\.[^.]+$/, ''), f)) ok++; else bad++
    }
    setImgMsg(`${ok} image${ok === 1 ? '' : 's'} saved${bad ? `, ${bad} failed` : ''}.`)
  }

  const delImage = async (key: string) => {
    try { await idbDel(key) } catch { /* ignore */ }
    setImgs((cur) => { const c = { ...cur }; if (c[key]) URL.revokeObjectURL(c[key].url); delete c[key]; return c })
  }

  const pick = (name: string) => imgs[nkey(name)] ?? builtin[nkey(name)]
  const hasImg = (n: string) => !!pick(n)
  const urlFor = (name: string) => pick(name)?.url

  // pictures for the PDF (png data, drawn at the item name)
  const loadPics = async (list: string[]) => {
    const out: Record<string, string> = {}
    for (const n of list) {
      const k = nkey(n)
      if (k in out) continue
      const im = imgs[k] ?? builtin[k]
      const d = im ? await toPng(im.url) : null
      if (d) out[k] = d
    }
    return out
  }

  return { imgs, builtin, imgMsg, saveImage, uploadMany, delImage, hasImg, urlFor, loadPics }
}

export type ImagesApi = ReturnType<typeof useImages>
