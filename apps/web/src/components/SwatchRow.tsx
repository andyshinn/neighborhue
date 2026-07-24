import type { PaletteColor } from '../lib/palette'
import styles from './SwatchRow.module.css'

interface SwatchRowProps {
  colors: PaletteColor[]
  // Home's hero highlights the color currently on the card (2d H11). Omitted
  // everywhere else, which keeps every existing row unhighlighted.
  activeHex?: string
}

export function SwatchRow({ colors, activeHex }: SwatchRowProps) {
  if (colors.length === 0) return null
  const active = activeHex?.toUpperCase()
  return (
    // One group label rather than 20 individually-announced chips: the palette
    // name above already carries the meaning.
    <div className={styles.row} role="img" aria-label={`${colors.length} palette colors`}>
      {colors.map((c) => (
        <span
          key={`${c.hex}-${c.name ?? ''}`}
          className={styles.swatch}
          style={{ background: c.hex }}
          data-active={active && c.hex.toUpperCase() === active ? 'true' : undefined}
          // Palette color names are nullable in the schema; fall back to the hex.
          title={c.name ? `${c.name} ${c.hex}` : c.hex}
        />
      ))}
    </div>
  )
}
