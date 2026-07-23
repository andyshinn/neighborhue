import * as Dialog from '@radix-ui/react-dialog'
import { ExclamationTriangleIcon, TrashIcon } from '@radix-ui/react-icons'
import styles from './DeleteDialog.module.css'

interface DeleteDialogProps {
  name: string | null
  status: 'idle' | 'deleting' | 'error'
  onConfirm: () => void
}

export function DeleteDialog({ name, status, onConfirm }: DeleteDialogProps) {
  const label = name ?? 'this neighborhood'
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className={styles.trigger}>
          <TrashIcon aria-hidden /> Delete
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <span className={styles.icon} aria-hidden>
            <ExclamationTriangleIcon width={24} height={24} />
          </span>
          <Dialog.Title className={styles.title}>Delete {label}?</Dialog.Title>
          <Dialog.Description className={styles.body}>
            This permanently removes the neighborhood. Neighbors' lights will stop updating and the link will 404. This can't
            be undone.
          </Dialog.Description>
          {status === 'error' && <p className={styles.error}>Couldn't delete — try again.</p>}
          <div className={styles.actions}>
            <Dialog.Close asChild>
              <button type="button" className={styles.cancel}>
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              className={styles.confirm}
              aria-label="Delete neighborhood permanently"
              disabled={status === 'deleting'}
              onClick={onConfirm}
            >
              <TrashIcon aria-hidden /> {status === 'deleting' ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
