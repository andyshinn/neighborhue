import { ArrowRightIcon, CheckIcon, SunIcon } from '@radix-ui/react-icons'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { usePaletteCycle } from '../hooks/usePaletteCycle'
import { formatHourLabel } from '../lib/hour'
import type { HeroPalette } from '../lib/palette'
import styles from './HomeHero.module.css'
import { ShareCard } from './ShareCard'

interface HomeHeroProps {
  palette: HeroPalette | null
}

// H4: the card rests on Rainbow's Blue — calmer than the palette's first color
// (pure red) at hero scale. Matched by hex, not index, so reordering the
// palette cannot silently change it; index 0 is the fallback if it is removed.
const RESTING_HEX = '#0080FF'
const EXAMPLE_NAME = 'Maple Street'
const EXAMPLE_HOUR = 7
const CYCLE_MS = 2000
const CHECKS = ['No accounts', 'No logins', 'About a minute to set up']

export function HomeHero({ palette }: HomeHeroProps) {
  const [hovering, setHovering] = useState(false)
  const colors = palette?.colors ?? []
  const restingIndex = Math.max(
    0,
    colors.findIndex((c) => c.hex.toUpperCase() === RESTING_HEX),
  )
  const cycleIndex = usePaletteCycle(colors.length, CYCLE_MS, hovering)
  // cycleIndex is 0 at rest, so the reel continues FROM the resting color on
  // hover rather than snapping back to index 0 (spec §5.2).
  const activeColor = colors.length > 0 ? colors[(restingIndex + cycleIndex) % colors.length] : null

  return (
    <section className={styles.hero}>
      <div className={styles.copy}>
        <span className={styles.eyebrow}>
          <SunIcon aria-hidden /> One color a day
        </span>
        <h1 className={styles.h1}>The whole neighborhood glows the same color.</h1>
        <p className={styles.sub}>
          Neighborhue gives your street one shared color that changes every morning. Point your smart lights at a single link
          — Home Assistant, LED bulbs, whatever you've got — and the whole block lights up together.
        </p>
        <div className={styles.ctas}>
          <Link to="/create" className={styles.primary}>
            Create a neighborhood <ArrowRightIcon aria-hidden />
          </Link>
          <a href="#how" className={styles.secondary}>
            How it works
          </a>
        </div>
        <ul className={styles.checks}>
          {CHECKS.map((label) => (
            <li key={label} className={styles.check}>
              <CheckIcon aria-hidden className={styles.checkIcon} /> {label}
            </li>
          ))}
        </ul>
      </div>

      {palette && activeColor && (
        // H5: hover/focus only — deliberately NOT focusable itself. The card has
        // no controls, so a tabIndex would add a dead focus stop; the hex, name
        // and every swatch are readable at rest, so nothing lives only in motion.
        <figure
          className={styles.cardWrap}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onFocusCapture={() => setHovering(true)}
          onBlurCapture={() => setHovering(false)}
        >
          <div className={styles.glow} style={{ background: activeColor.hex }} aria-hidden />
          <div className={styles.card}>
            <ShareCard
              name={EXAMPLE_NAME}
              activeColor={activeColor}
              colors={palette.colors}
              paletteName={palette.name}
              rotationLabel={formatHourLabel(EXAMPLE_HOUR)}
              activeHex={activeColor.hex}
            />
          </div>
          <figcaption className="sr-only">Example of a neighborhood's daily color card.</figcaption>
        </figure>
      )}
    </section>
  )
}
