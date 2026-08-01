import { useEffect, useState } from 'react'
import { colorTheme } from '../color/theme'
import { useCountdown } from '../hooks/useCountdown'
import { formatCountdown } from '../lib/countdown'
import { type HeroExample, nextLocalOccurrence } from '../lib/heroExample'
import { formatHourLabel } from '../lib/hour'
import styles from './HomeCard.module.css'
import { Logo } from './Logo'

interface HomeCardProps {
  example: HeroExample
  // Fired once when the countdown reaches zero, so the route can pull the new
  // color. Absent on the fallback card, which has nothing to refetch.
  onExpire?: () => void
}

const PLACEHOLDER = '--:--:--'

export function HomeCard({ example, onExpire }: HomeCardProps) {
  const theme = colorTheme(example.hex)

  // The fallback card has no server rotation to count toward, so it counts to
  // the next 7am where the READER is — computed after mount, because the
  // server's zone is not theirs and the two renders would disagree. Until then
  // it prints PLACEHOLDER, which is the same 8 characters wide as HH:MM:SS, so
  // nothing moves when the real value arrives.
  const [localTarget, setLocalTarget] = useState<string | null>(null)
  useEffect(() => {
    if (example.nextRotationAt !== null) return
    setLocalTarget(nextLocalOccurrence(example.rotationHour))
  }, [example.nextRotationAt, example.rotationHour])

  const target = example.nextRotationAt ?? localTarget
  const seconds = useCountdown(example.seconds, target, onExpire ?? noop)

  return (
    <div className={styles.card}>
      <div
        className={styles.colorPanel}
        // panelBg, never example.hex: mid-tone hues are darkened just enough to
        // carry white ink. The chip below always prints the true value.
        style={{ background: theme.panelBg, color: theme.ink }}
      >
        <div className={styles.colorTop}>
          <Logo lockup={theme.lockup} height={30} />
          <span className={styles.hexChip} style={{ background: theme.chipBg }}>
            {example.hex}
          </span>
        </div>
        <div>
          <p className={styles.eyebrow} style={{ color: theme.inkMuted }}>
            {example.name} · today
          </p>
          <p className={styles.colorName}>{example.colorName}</p>
        </div>
      </div>

      <div className={styles.detailPanel}>
        <div className={styles.countdownBlock}>
          <span className={styles.countdownLabel}>Next color in</span>
          {/* Deliberately not aria-live: this changes every second and would
              flood a screen reader. It reads normally when navigated to. */}
          <p className={styles.countdown}>
            <span className="sr-only">Time until the next color: </span>
            {target === null ? PLACEHOLDER : formatCountdown(seconds)}
          </p>
        </div>

        <div className={styles.rule} />

        <div className={styles.paletteRow}>
          <span className={styles.paletteName}>{example.paletteName}</span>
          {example.colors.map((c) => (
            <span
              key={`${c.hex}-${c.name ?? ''}`}
              className={styles.swatch}
              style={{ background: c.hex }}
              title={c.name ? `${c.name} ${c.hex}` : c.hex}
            />
          ))}
        </div>

        <p className={styles.rotates}>Rotates daily at {formatHourLabel(example.rotationHour)}</p>
      </div>
    </div>
  )
}

function noop() {}
