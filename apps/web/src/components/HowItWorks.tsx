import { MixerHorizontalIcon, Share1Icon, SunIcon } from '@radix-ui/react-icons'
import styles from './HowItWorks.module.css'

// "Seven" is verified against the live API: 7 curated palettes, default rainbow.
const CARDS = [
  {
    tone: 'indigo',
    Icon: MixerHorizontalIcon,
    title: 'Pick a palette',
    body: 'Seven vivid palettes tuned for cheap RGB bulbs — or define your own custom colors.',
  },
  {
    tone: 'pink',
    Icon: Share1Icon,
    title: 'Share the link',
    body: 'Drop the public link in the group chat. Neighbors just open it — no app to install.',
  },
  {
    tone: 'amber',
    Icon: SunIcon,
    title: 'Point your lights',
    body: "Home Assistant reads today's color and applies it to your lights automatically each morning.",
  },
] as const

export function HowItWorks() {
  return (
    <section id="how" className={styles.section}>
      <h2 className={styles.eyebrow}>How it works</h2>
      <div className={styles.cards}>
        {CARDS.map(({ tone, Icon, title, body }) => (
          <article key={title} className={styles.card}>
            <div className={styles.tile} data-tone={tone}>
              <Icon aria-hidden width={20} height={20} />
            </div>
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.body}>{body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
