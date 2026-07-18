import type { PublicColor } from '@neighborhue/api/types'
import type { CSSProperties } from 'react'
import { colorTheme } from '../color/theme'

interface ColorFieldProps {
  name: string | null
  color: PublicColor
}

// The minimal honest Share page (spec §3.1): the hue fills the field, ink is
// computed for contrast, and hex + name are always shown as text. No layout,
// countdown, panel, or glow — those are Spec 2.
export function ColorField({ name, color }: ColorFieldProps) {
  const t = colorTheme(color.hex)
  const style = {
    '--hue': color.hex,
    '--ink': t.ink,
    '--ink-muted': t.inkMuted,
    background: 'var(--hue)',
    color: 'var(--ink)',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: 32,
    gap: 8,
  } as CSSProperties

  return (
    <main style={style}>
      <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>{name ?? 'Neighborhue'} · Today</p>
      <h1 style={{ fontSize: 'clamp(48px, 12vw, 104px)', fontWeight: 600, letterSpacing: '-0.04em' }}>
        {color.name ?? color.hex}
      </h1>
      <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>{color.hex}</p>
    </main>
  )
}
