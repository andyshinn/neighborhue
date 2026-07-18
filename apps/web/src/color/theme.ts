export type Ink = '#181310' | '#ffffff'

export interface ColorTheme {
  ink: Ink
  inkMuted: string
  chipBg: string
  lockup: 'light' | 'dark-text'
}

function toRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

// sRGB → linearized relative luminance (WCAG). 0.2126R + 0.7152G + 0.0722B.
export function relativeLuminance(hex: string): number {
  const linear = toRgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

export function alpha(hex: string, a: number): string {
  const [r, g, b] = toRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

// Ink is whichever of near-black / white has higher contrast against the hue.
// Note: contrast is computed against pure black but rendered as #181310 (warm
// near-black); the discrepancy is negligible (spec §6.1).
export function colorTheme(hex: string): ColorTheme {
  const L = relativeLuminance(hex)
  const ink: Ink = (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? '#181310' : '#ffffff'
  return {
    ink,
    inkMuted: alpha(ink, 0.68),
    chipBg: alpha(ink, 0.12),
    lockup: ink === '#ffffff' ? 'light' : 'dark-text',
  }
}
