import type { PublicColor } from '@neighborhue/api/types'
import { Link } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import { colorTheme } from '../color/theme'
import { Logo } from './Logo'
import styles from './ShareColorField.module.css'

interface ShareColorFieldProps {
  name: string | null
  color: PublicColor
  paletteName: string
}

export function ShareColorField({ name, color, paletteName }: ShareColorFieldProps) {
  const t = colorTheme(color.hex)
  const style = {
    '--hue': color.hex,
    '--ink': t.ink,
    '--ink-muted': t.inkMuted,
    '--chip-bg': t.chipBg,
  } as CSSProperties

  return (
    <section className={styles.field} style={style}>
      <div className={styles.top}>
        <Link to="/" aria-label="Neighborhue home">
          <Logo lockup={t.lockup} />
        </Link>
        <span className={styles.chip}>{color.hex}</span>
      </div>

      <div className={styles.bottom}>
        <p className={styles.eyebrow}>{name ?? 'Neighborhue'} · Today</p>
        <h1 className={styles.name}>{color.name ?? color.hex}</h1>
        <p className={styles.meta}>
          {color.hex} · {paletteName}
        </p>
        <p className={styles.tagline}>Point your lights here — the whole street glows together.</p>
      </div>
    </section>
  )
}
