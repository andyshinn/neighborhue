import type { ColorTheme } from '../color/theme'

interface LogoProps {
  // Comes from colorTheme(hex).lockup — 'light' means a light wordmark for a
  // dark background, and vice versa.
  lockup: ColorTheme['lockup']
  height?: number
}

export function Logo({ lockup, height = 44 }: LogoProps) {
  const src = lockup === 'light' ? '/lockup-light.png' : '/lockup-dark-text.png'
  return <img src={src} alt="Neighborhue" style={{ height, width: 'auto' }} />
}
