import { ArrowRightIcon, CheckIcon, SunIcon } from '@radix-ui/react-icons'
import { Link } from '@tanstack/react-router'
import type { HeroExample } from '../lib/heroExample'
import { HomeCard } from './HomeCard'
import styles from './HomeHero.module.css'

interface HomeHeroProps {
  example: HeroExample
  onExpire?: () => void
}

const CHECKS = ['No accounts', 'No logins', 'About a minute to set up']

export function HomeHero({ example, onExpire }: HomeHeroProps) {
  return (
    <section className={styles.hero}>
      <div className={styles.copy}>
        <span className={styles.eyebrow}>
          <SunIcon aria-hidden className={styles.eyebrowIcon} /> One color a day
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
          {/* Only offered when there is a real neighborhood to land on. With no
              demo configured the hero keeps one button rather than promising a
              live example it cannot show. */}
          {example.id && (
            <Link to="/n/$id" params={{ id: example.id }} className={styles.secondary}>
              See a live example
            </Link>
          )}
        </div>
        <ul className={styles.checks}>
          {CHECKS.map((label) => (
            <li key={label} className={styles.check}>
              <CheckIcon aria-hidden className={styles.checkIcon} /> {label}
            </li>
          ))}
        </ul>
      </div>

      <figure className={styles.cardWrap}>
        {/* Two washes of the TRUE hue (not the ink-adjusted panel color): the
            near one is the card's own spill, the far one only exists in dark,
            where it keeps the color from ending in a hard rectangle edge. */}
        <div className={styles.glowFar} style={{ background: example.hex }} aria-hidden />
        <div className={styles.glow} style={{ background: example.hex }} aria-hidden />
        <HomeCard example={example} onExpire={onExpire} />
        {/* Present only while the card is an illustration. Once it is reading a
            real neighborhood there is nothing to disclaim. */}
        {!example.live && <figcaption className="sr-only">Example of a neighborhood's daily color card.</figcaption>}
      </figure>
    </section>
  )
}
