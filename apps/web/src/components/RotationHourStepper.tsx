import { MinusIcon, PlusIcon } from '@radix-ui/react-icons'
import { formatHourLabel } from '../lib/hour'
import styles from './RotationHourStepper.module.css'

interface RotationHourStepperProps {
  hour: number
  onChange: (hour: number) => void
}

export function RotationHourStepper({ hour, onChange }: RotationHourStepperProps) {
  return (
    <div className={styles.stepper}>
      <button type="button" className={styles.step} aria-label="Earlier hour" onClick={() => onChange((hour + 23) % 24)}>
        <MinusIcon aria-hidden />
      </button>
      <div className={styles.readout} aria-live="polite">
        <span className={styles.readoutText}>
          <span className={styles.label}>{formatHourLabel(hour)}</span>
          <span className={styles.tag}>local</span>
        </span>
      </div>
      <button type="button" className={styles.step} aria-label="Later hour" onClick={() => onChange((hour + 1) % 24)}>
        <PlusIcon aria-hidden />
      </button>
    </div>
  )
}
