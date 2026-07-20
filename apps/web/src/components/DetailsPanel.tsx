import type { ResolvedPalette } from '../lib/palette'
import { CopyButton } from './CopyButton'
import { Countdown } from './Countdown'
import styles from './DetailsPanel.module.css'
import { HaPanel } from './HaPanel'
import { SwatchRow } from './SwatchRow'

interface DetailsPanelProps {
  name: string | null
  neighborhoodId: string
  shareUrl: string
  seconds: number
  palette: ResolvedPalette
  hue: string
  ink: string
}

export function DetailsPanel({ name, neighborhoodId, shareUrl, seconds, palette, hue, ink }: DetailsPanelProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.topRow}>
        <span className={styles.neighborhood}>{name ?? 'Neighborhue'}</span>
        {/* Static label: the page follows the system theme, there is nothing
            to toggle (spec S5). */}
        <span className={styles.auto}>Auto</span>
      </div>

      <div>
        <p className={styles.label}>Next color in</p>
        <Countdown seconds={seconds} />
      </div>

      <hr className={styles.hairline} />

      <div>
        <p className={styles.paletteName}>{palette.kind === 'custom' ? 'Custom colors' : palette.name}</p>
        {palette.kind === 'curated' && <SwatchRow colors={palette.colors} />}
      </div>

      <div className={styles.actions}>
        <CopyButton
          value={shareUrl}
          label="Copy share link"
          variant="primary"
          // Tinted to the daily color, per handoff §3.
          style={{ background: hue, color: ink }}
        />
        <HaPanel neighborhoodId={neighborhoodId} />
      </div>
    </section>
  )
}
