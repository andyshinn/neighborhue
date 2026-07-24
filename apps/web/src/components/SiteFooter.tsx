import * as Collapsible from '@radix-ui/react-collapsible'
import styles from './SiteFooter.module.css'
import { SiteLogo } from './SiteLogo'

const GITHUB_URL = 'https://github.com/andyshinn/neighborhue'

// H8: a factual claim about this codebase, not marketing. Verified — no
// analytics, tracking, or error-reporting SDK is installed. If one is ever
// added, this sentence must change.
const PRIVACY =
  'No accounts, no logins, no tracking or analytics. A neighborhood stores only your name, time zone, rotation hour, and colors — and anyone with its secret link can delete it permanently.'

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <Collapsible.Root>
        <div className={styles.row}>
          <SiteLogo size="footer" asLink={false} />
          <span className={styles.tagline}>A shared color for the whole neighborhood.</span>
          <nav className={styles.links} aria-label="Footer">
            <a href="#how" className={styles.link}>
              How it works
            </a>
            <Collapsible.Trigger className={styles.link}>Privacy</Collapsible.Trigger>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={styles.link}>
              GitHub
            </a>
          </nav>
        </div>
        <Collapsible.Content>
          <p className={styles.privacy}>{PRIVACY}</p>
        </Collapsible.Content>
      </Collapsible.Root>
    </footer>
  )
}
