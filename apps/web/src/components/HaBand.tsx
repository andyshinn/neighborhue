import { RocketIcon } from '@radix-ui/react-icons'
import styles from './HaBand.module.css'

// H6: the handoff described a HACS integration and a one-click blueprint
// import; neither exists. This describes what actually ships — the REST sensor
// and automation YAML that HaPanel discloses on every share page (spec 2a).
// No button: there is no setup page to stand behind yet.
export function HaBand() {
  return (
    <section className={styles.band}>
      <div className={styles.tile}>
        <RocketIcon aria-hidden width={24} height={24} />
      </div>
      <div className={styles.text}>
        <h2 className={styles.title}>Made for Home Assistant</h2>
        <p className={styles.body}>
          Every neighborhood page carries a ready-made REST sensor and automation — copy the YAML into your{' '}
          <code className={styles.code}>configuration.yaml</code> and Home Assistant applies today's color each
          morning. Plain RGB bulbs work too.
        </p>
      </div>
    </section>
  )
}
