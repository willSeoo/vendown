import type { Tab } from '../types'

const TABS = [
  ['items', '📦', 'Items'],
  ['report', '🧾', 'Sales'],
  ['market', '📈', 'Market'],
  ['promo', '📣', 'Promo'],
  ['images', '🖼️', 'Images'],
] as const

/** Bottom bar on phones, top bar on desktop (see styles/layout.css). */
export default function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabs" aria-label="Main">
      {TABS.map(([k, icon, label]) => (
        <button key={k} aria-pressed={tab === k} onClick={() => { onChange(k); window.scrollTo({ top: 0 }) }}>
          <span aria-hidden="true">{icon}</span>{label}
        </button>
      ))}
    </nav>
  )
}
