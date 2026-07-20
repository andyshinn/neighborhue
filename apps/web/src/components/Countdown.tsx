import { formatCountdown } from '../lib/countdown'
import styles from './Countdown.module.css'

interface CountdownProps {
  seconds: number
}

export function Countdown({ seconds }: CountdownProps) {
  return (
    // Deliberately NOT aria-live (spec S11): this updates every second and
    // would flood a screen reader. It reads normally when navigated to.
    <p className={styles.countdown}>
      <span className="sr-only">Time until the next color: </span>
      {formatCountdown(seconds)}
    </p>
  )
}
