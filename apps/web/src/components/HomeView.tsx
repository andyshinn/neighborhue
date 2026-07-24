import { PlusIcon } from '@radix-ui/react-icons'
import { Link } from '@tanstack/react-router'
import type { HeroPalette } from '../lib/palette'
import { HaBand } from './HaBand'
import { HomeHero } from './HomeHero'
import styles from './HomeView.module.css'
import { HowItWorks } from './HowItWorks'
import { SiteFooter } from './SiteFooter'
import { SiteLogo } from './SiteLogo'

interface HomeViewProps {
  palette: HeroPalette | null
}

export function HomeView({ palette }: HomeViewProps) {
  return (
    <div className={styles.page}>
      {/* H2: the handoff's "Live example" button is gone — there is no example
          neighborhood, so it could only point at /create. */}
      <nav className={styles.nav}>
        <SiteLogo />
        <Link to="/create" className={styles.create}>
          <PlusIcon aria-hidden /> Create
        </Link>
      </nav>
      <main className={styles.main}>
        <HomeHero palette={palette} />
        <HowItWorks />
        <HaBand />
      </main>
      <SiteFooter />
    </div>
  )
}
