import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons'
import { useId } from 'react'
import { validateTimezone } from '../lib/timezone'
import styles from './TimezoneField.module.css'

interface TimezoneFieldProps {
  value: string
  onChange: (value: string) => void
  detectedZone: string
}

export function TimezoneField({ value, onChange, detectedZone }: TimezoneFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const valid = validateTimezone(value)
  const hint = !valid
    ? 'Use an IANA zone like America/New_York.'
    : value === detectedZone
      ? 'Detected from your device.'
      : 'Looks good.'

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        Time zone
      </label>
      <input
        id={id}
        className={styles.input}
        value={value}
        placeholder="America/New_York"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-invalid={!valid}
        aria-describedby={hintId}
        onChange={(e) => onChange(e.target.value)}
      />
      <p id={hintId} aria-live="polite" className={valid ? styles.hintOk : styles.hintBad}>
        {valid ? <CheckIcon aria-hidden /> : <Cross2Icon aria-hidden />}
        <span>{hint}</span>
      </p>
    </div>
  )
}
