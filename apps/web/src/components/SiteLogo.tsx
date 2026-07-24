import { Link } from '@tanstack/react-router'
import styles from './SiteLogo.module.css'

interface SiteLogoProps {
  size?: 'nav' | 'footer'
  // The footer sits on a page that already links home from the nav, so its mark
  // is decorative rather than a second, redundant link.
  asLink?: boolean
}

// The neutral-chrome lockup: the image swaps by system theme in pure CSS (the
// ink-based Logo is only right on the colored panel). Extracted in 2d H10 —
// this markup was duplicated verbatim in CreateView and ManageView.
export function SiteLogo({ size = 'nav', asLink = true }: SiteLogoProps) {
  const className = `${styles.logo} ${size === 'footer' ? styles.footer : styles.nav}`
  if (!asLink) return <span className={className} role="img" aria-label="Neighborhue" />
  return <Link to="/" aria-label="Neighborhue home" className={className} />
}
