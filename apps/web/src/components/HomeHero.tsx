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
  const [hoveredHex, setHoveredHex] = useState<string | null>(null)
  const colors = palette?.colors ?? []
  const restingIndex = Math.max(
    0,
    colors.findIndex((c) => c.hex.toUpperCase() === RESTING_HEX),
  )
  // The reel runs on its own — the card should read as "this changes daily"
  // without asking for a hover first. cycleIndex starts at 0, so it opens on
  // the resting color and walks forward from there, not from index 0.
  const cycleIndex = usePaletteCycle(colors.length, CYCLE_MS)
  const cycledColor = colors.length > 0 ? colors[(restingIndex + cycleIndex) % colors.length] : null
  // Hovering a swatch pins that color, exactly as on Create; releasing hands
  // the card back to the reel.
  const activeColor = (hoveredHex ? colors.find((c) => c.hex === hoveredHex) : null) ?? cycledColor

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
        // H5: the figure itself is deliberately NOT focusable — the swatches
        // inside it are the controls, and the hex, name and every swatch are
        // readable at rest, so nothing lives only in motion.
        <figure className={styles.cardWrap}>
          <div className={styles.glow} style={{ background: activeColor.hex }} aria-hidden />
          <div className={styles.card}>
            <ShareCard
              name={EXAMPLE_NAME}
              activeColor={activeColor}
              colors={palette.colors}
              paletteName={palette.name}
              rotationLabel={formatHourLabel(EXAMPLE_HOUR)}
              activeHex={activeColor.hex}
              onPreviewColor={setHoveredHex}
            />
          </div>
          <figcaption className="sr-only">Example of a neighborhood's daily color card.</figcaption>
        </figure>
      )}
    </section>
  )
}
