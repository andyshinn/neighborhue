import { CheckIcon } from '@radix-ui/react-icons'
import styles from './SaveIndicator.module.css'

interface SaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error'
  onRetry?: () => void
}

export function SaveIndicator({ status, onRetry }: SaveIndicatorProps) {
  if (status === 'idle') return null

  return (
    <span className={styles.wrap} aria-live="polite">
      {status === 'saving' && <span className={styles.muted}>Saving…</span>}
      {status === 'saved' && (
        <span className={styles.saved}>
          <CheckIcon aria-hidden /> Saved
        </span>
      )}
      {status === 'error' && (
        <span className={styles.error}>
          Couldn't save —{' '}
          <button type="button" className={styles.retry} onClick={onRetry}>
            Retry
          </button>
        </span>
      )}
    </span>
  )
}
