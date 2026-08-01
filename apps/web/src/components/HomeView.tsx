import { PlusIcon } from '@radix-ui/react-icons'
import { Link } from '@tanstack/react-router'
import type { HeroExample } from '../lib/heroExample'
import { HaBand } from './HaBand'
import { HomeHero } from './HomeHero'
import styles from './HomeView.module.css'
import { HowItWorks } from './HowItWorks'
import { SiteFooter } from './SiteFooter'
import { SiteLogo } from './SiteLogo'

interface HomeViewProps {
  example: HeroExample
  onExpire?: () => void
}

export function HomeView({ example, onExpire }: HomeViewProps) {
  return (
    <div className={styles.page}>
      <nav className={styles.nav} aria-label="Main">
        <SiteLogo />
        <div className={styles.navActions}>
          {/* Withheld when no demo neighborhood is configured — see the same
              condition on the hero's secondary CTA. */}
          {example.id && (
            <Link to="/n/$id" params={{ id: example.id }} className={styles.navLink}>
              Live example
            </Link>
          )}
          <Link to="/create" className={styles.create}>
            <PlusIcon aria-hidden /> Create
          </Link>
        </div>
      </nav>
      <main className={styles.main}>
        <HomeHero example={example} onExpire={onExpire} />
        <HowItWorks />
        <HaBand />
      </main>
      <SiteFooter />
    </div>
  )
}
