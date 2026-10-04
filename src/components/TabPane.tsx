import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Keeps a tab alive after its first visit (just hidden), so search text, expanded cards
 * and half-filled forms survive switching tabs.
 */
export default function TabPane({ active, children }: { active: boolean; children: ReactNode }) {
  const [seen, setSeen] = useState(active)
  useEffect(() => {
    if (active) setSeen(true)
  }, [active])
  if (!active && !seen) return null
  return <div className="tabpane" hidden={!active}>{children}</div>
}
