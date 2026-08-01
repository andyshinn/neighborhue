import { useEffect, useState } from 'react'

const DEFAULT_INTERVAL_MS = 2000

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// Walks 0..length-1 on a timer so the Home and Create previews read as a sample
// reel ("one of these, chosen each day"), never a fixed "today". Honors
// prefers-reduced-motion (C11) and resets when the palette (length) changes.
export function usePaletteCycle(length: number, intervalMs: number = DEFAULT_INTERVAL_MS): number {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
    if (length <= 1 || prefersReducedMotion()) return
    const id = setInterval(() => setIndex((i) => (i + 1) % length), intervalMs)
    return () => clearInterval(id)
  }, [length, intervalMs])

  return length > 0 ? index % length : 0
}
