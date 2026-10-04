/** Two-step delete: the first tap arms the button, the second tap (within 3 s) runs the action. */
import { useState } from 'react'

export function useConfirm(ms = 3000) {
  const [armed, setArmed] = useState<string | number | null>(null)
  const ask = (key: string | number, run: () => void) => {
    if (armed === key) {
      run()
      setArmed(null)
    } else {
      setArmed(key)
      setTimeout(() => setArmed((cur) => (cur === key ? null : cur)), ms)
    }
  }
  return { armed, ask }
}
