import { ArrowRightIcon, RocketIcon } from '@radix-ui/react-icons'
import styles from './HaBand.module.css'

// The setup instructions live in the repo README's Home Assistant section —
// the only setup documentation that exists today. If the HACS integration ever
// gets its own docs site, this is the one line to change.
const SETUP_URL = 'https://github.com/andyshinn/neighborhue#home-assistant'

export function HaBand() {
  return (
    <section className={styles.band}>
      <div className={styles.tile}>
        <RocketIcon aria-hidden width={24} height={24} />
      </div>
      <div className={styles.text}>
        <h2 className={styles.title}>Made for Home Assistant</h2>
        <p className={styles.body}>
          Install the Neighborhue integration from HACS and paste your neighborhood ID, or one-click import the blueprint
          automation. Plain RGB bulbs work too.
        </p>
      </div>
      <a className={styles.cta} href={SETUP_URL} target="_blank" rel="noopener noreferrer">
        See the setup <ArrowRightIcon aria-hidden />
      </a>
    </section>
  )
}
