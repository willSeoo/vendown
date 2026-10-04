/** "WL each" or "per 1 WL" (bulk, e.g. 200/1) price type. */
import type { ChangeEvent } from 'react'

type Props = { label: string; value: string; onChange: (e: ChangeEvent<HTMLSelectElement>) => void }

export default function ModeSelect({ label, value, onChange }: Props) {
  return (
    <select value={value} onChange={onChange} aria-label={label}>
      <option value="each">WL each</option>
      <option value="bulk">per 1 WL (e.g. 200/1)</option>
    </select>
  )
}
