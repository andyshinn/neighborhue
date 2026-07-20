import type { PaletteColor } from '../lib/palette'
import styles from './SwatchRow.module.css'

interface SwatchRowProps {
  colors: PaletteColor[]
}

export function SwatchRow({ colors }: SwatchRowProps) {
  if (colors.length === 0) return null
  return (
    // One group label rather than 20 individually-announced chips: the palette
    // name above already carries the meaning.
    <div className={styles.row} role="img" aria-label={`${colors.length} palette colors`}>
      {colors.map((c) => (
        <span
          key={`${c.hex}-${c.name ?? ''}`}
          className={styles.swatch}
          style={{ background: c.hex }}
          // Palette color names are nullable in the schema; fall back to the hex.
          title={c.name ? `${c.name} ${c.hex}` : c.hex}
        />
      ))}
    </div>
  )
}
