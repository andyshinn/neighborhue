import { colorTheme } from '../color/theme'
import type { PaletteColor } from '../lib/palette'
import { Logo } from './Logo'
import styles from './ShareCard.module.css'
import { SwatchRow } from './SwatchRow'

interface ShareCardProps {
  name: string | null
  activeColor: PaletteColor | null
  colors: PaletteColor[]
  paletteName: string
  rotationLabel: string
  activeHex?: string
  onPreviewColor?: (hex: string | null) => void
}

export function ShareCard({
  name,
  activeColor,
  colors,
  paletteName,
  rotationLabel,
  activeHex,
  onPreviewColor,
}: ShareCardProps) {
  const theme = activeColor ? colorTheme(activeColor.hex) : null
  const displayName = name?.trim() ? name.trim() : 'Your neighborhood'
  const highlight = activeHex ?? activeColor?.hex

  return (
    <div className={styles.card}>
      {activeColor && theme ? (
        <div className={styles.colorPanel} style={{ background: theme.panelBg, color: theme.ink }}>
          <div className={styles.colorTop}>
            <Logo lockup={theme.lockup} height={30} />
            <span className={styles.hexChip} style={{ background: theme.chipBg }}>
              {activeColor.hex}
            </span>
          </div>
          <div>
            <p className={styles.eyebrow}>{displayName} · today</p>
            <p className={styles.colorName}>{activeColor.name ?? activeColor.hex}</p>
          </div>
        </div>
      ) : (
        <div className={styles.customPanel}>
          <p className={styles.customText}>Your custom colors</p>
          <p className={styles.customSub}>You'll add them in Manage</p>
        </div>
      )}

      <div className={styles.infoPanel}>
        <div>
          <p className={styles.paletteName}>{paletteName}</p>
          {onPreviewColor ? (
            <fieldset className={styles.swatchRow} aria-label="Palette colors — hover to preview">
              {colors.map((c) => (
                // The color lives on an inner chip so the button itself can be
                // pure padding: buttons tile edge to edge, and the pointer
                // never crosses dead space between them (which would drop the
                // preview back to the cycling color for a frame).
                <button
                  key={`${c.hex}-${c.name ?? ''}`}
                  type="button"
                  className={styles.swatch}
                  data-active={c.hex === highlight || undefined}
                  aria-label={c.name ? `${c.name} ${c.hex}` : c.hex}
                  onMouseEnter={() => onPreviewColor(c.hex)}
                  onFocus={() => onPreviewColor(c.hex)}
                  onMouseLeave={() => onPreviewColor(null)}
                  onBlur={() => onPreviewColor(null)}
                >
                  <span className={styles.chip} style={{ background: c.hex }} />
                </button>
              ))}
            </fieldset>
          ) : (
            colors.length > 0 && <SwatchRow colors={colors} activeHex={activeHex} />
          )}
        </div>
        <p className={styles.rotates}>Rotates daily at {rotationLabel}</p>
      </div>
    </div>
  )
}
