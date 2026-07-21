import type { CreatedNeighborhood } from '@neighborhue/api/types'
import { CheckCircledIcon, ExclamationTriangleIcon, EyeOpenIcon, GearIcon, LockClosedIcon } from '@radix-ui/react-icons'
import { Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { CopyButton } from './CopyButton'
import styles from './CreateSuccess.module.css'

interface CreateSuccessProps {
  created: CreatedNeighborhood
}

export function CreateSuccess({ created }: CreateSuccessProps) {
  const shareUrl = `https://neighborhue.app/n/${created.id}`
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div className={styles.card}>
      <div className={styles.check} aria-hidden>
        <CheckCircledIcon width={28} height={28} />
      </div>
      <h2 ref={headingRef} tabIndex={-1} className={styles.title}>
        Your neighborhood is live
      </h2>
      <p className={styles.body}>
        Share the public link with your neighbors. Keep the management link somewhere safe — it's how you get back in.
      </p>

      <div className={styles.block}>
        <p className={styles.label}>Public share link</p>
        <div className={styles.linkRow}>
          <span className={styles.url}>{shareUrl}</span>
          <CopyButton value={shareUrl} label="Copy public link" />
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.label}>
          <LockClosedIcon aria-hidden /> Private management link
        </p>
        <div className={styles.linkRow}>
          <span className={styles.url}>{created.manage_url}</span>
          <CopyButton value={created.manage_url} label="Copy management link" />
        </div>
        <p className={styles.warning}>
          <ExclamationTriangleIcon aria-hidden />
          <span>Save this link — it's the only way back in. There are no accounts, and it can't be recovered if lost.</span>
        </p>
      </div>

      <div className={styles.actions}>
        <Link to="/n/$id" params={{ id: created.id }} className={styles.primary}>
          <EyeOpenIcon aria-hidden /> Open share page
        </Link>
        <Link to="/manage/$id" params={{ id: created.id }} hash={created.admin_secret} className={styles.secondary}>
          <GearIcon aria-hidden /> Go to manage
        </Link>
      </div>
    </div>
  )
}
