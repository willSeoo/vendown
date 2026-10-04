import { useState } from 'react'
import Thumb from './Thumb'
import { nkey } from '../lib/names'
import { useShop } from '../store/ShopContext'

type Props = { value: string; onType: (v: string) => void; onPick: (name: string) => void }

/** Item name input with suggestions (picture + name) from built-in pictures, uploads, market notes and stock. */
export default function NameSuggest({ value, onType, onPick }: Props) {
  const { items, market, images } = useShop()
  const [show, setShow] = useState(false)
  const catalog = Array.from(
    new Map([...Object.values(images.builtin), ...Object.values(images.imgs), ...market, ...items].map((x): [string, string] => [nkey(x.name), x.name])).values(),
  )
  const q = nkey(value)
  const sugs = q
    ? catalog
        .filter((n) => nkey(n).includes(q) && nkey(n) !== q)
        .sort((a, b) => Number(nkey(b).startsWith(q)) - Number(nkey(a).startsWith(q)) || a.localeCompare(b))
        .slice(0, 8)
    : []
  return (
    <div className="sugwrap">
      <label>Item name
        <input
          required maxLength={60} value={value} autoComplete="off" placeholder="e.g. Climbing Vine"
          onChange={(e) => { onType(e.target.value); setShow(true) }}
          onFocus={() => setShow(true)}
          onBlur={() => setTimeout(() => setShow(false), 150)}
        />
      </label>
      {show && sugs.length > 0 && (
        <ul className="sug" role="listbox" aria-label="Suggestions">
          {sugs.map((n) => (
            <li key={n} role="option" aria-selected="false" onMouseDown={(e) => { e.preventDefault(); onPick(n); setShow(false) }}>
              <Thumb name={n} /><span>{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
