export type Ink = '#181310' | '#ffffff'

export interface ColorTheme {
  ink: Ink
  inkMuted: string
  chipBg: string
  lockup: 'light' | 'dark-text'
  /**
   * What to actually PAINT behind the ink. Usually the hue itself; for
   * saturated mid-tones it is the hue darkened just enough to carry white ink
   * at 4.5:1. Never present this as "the color" — the hex chip and the color
   * name always render the original, undarkened value.
   */
  panelBg: string
}

function toRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [Number.parseInt(h.slice(0, 2), 16), Number.parseInt(h.slice(2, 4), 16), Number.parseInt(h.slice(4, 6), 16)]
}

function toHex(rgb: [number, number, number]): string {
  const part = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c)))
      .toString(16)
      .padStart(2, '0')
  return `#${part(rgb[0])}${part(rgb[1])}${part(rgb[2])}`
}

function linearize(channel: number): number {
  const s = channel / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminanceOfRgb(rgb: [number, number, number]): number {
  return 0.2126 * linearize(rgb[0]) + 0.7152 * linearize(rgb[1]) + 0.0722 * linearize(rgb[2])
}

// sRGB → linearized relative luminance (WCAG). 0.2126R + 0.7152G + 0.0722B.
export function relativeLuminance(hex: string): number {
  return luminanceOfRgb(toRgb(hex))
}

// Contrast of pure white against a background of the given luminance.
function whiteContrast(luminance: number): number {
  return 1.05 / (luminance + 0.05)
}

export function alpha(hex: string, a: number): string {
  const [r, g, b] = toRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

const AA = 4.5
// How far the panel may be darkened toward black before we give up on white
// ink. Past roughly this point the panel stops reading as the color it claims
// to be, and the hue is the product — it outranks the ink preference.
const MAX_DARKEN = 0.2
const DARKEN_STEP = 0.01

/**
 * Ink for a background that is an arbitrary, saturated hue.
 *
 * Deliberately NOT naive maximum contrast. Against #0080FF, black scores 5.5:1
 * and white 3.8:1, so "pick the higher" chooses black — legible, but visually
 * muddy, and it drags the dark-text lockup onto mid-tone blue where it all but
 * disappears. This is a product about colored light, so white ink is the
 * default and the background yields to it:
 *
 *   1. White already clears AA on the true hue → white ink, hue untouched.
 *   2. Otherwise darken the panel toward black, up to MAX_DARKEN, until white
 *      clears AA → white ink on the darkened hue.
 *   3. Still short (genuinely light hues — yellows, marigold, warm white) →
 *      #181310 ink on the true hue.
 *
 * Only the painted surface is ever darkened, and only in case 2. `panelBg`
 * carries it; every textual rendering of the color uses the original, so
 * meaning never depends on the adjustment — or on color at all.
 *
 * Note: contrast is computed against pure black but rendered as #181310 (warm
 * near-black); the discrepancy is negligible (spec §6.1).
 */
export function colorTheme(hex: string): ColorTheme {
  const rgb = toRgb(hex)
  let panelBg = hex
  let useWhite = whiteContrast(luminanceOfRgb(rgb)) >= AA

  if (!useWhite) {
    for (let amount = DARKEN_STEP; amount <= MAX_DARKEN + 1e-9; amount += DARKEN_STEP) {
      const scaled: [number, number, number] = [rgb[0] * (1 - amount), rgb[1] * (1 - amount), rgb[2] * (1 - amount)]
      if (whiteContrast(luminanceOfRgb(scaled)) >= AA) {
        panelBg = toHex(scaled)
        useWhite = true
        break
      }
    }
  }

  const ink: Ink = useWhite ? '#ffffff' : '#181310'
  return {
    ink,
    inkMuted: alpha(ink, 0.68),
    // 0.14 rather than 0.12: the chip is the accessibility fallback for the hue
    // — the one place the exact value is legible as text — so it has to hold
    // its own edge against a saturated background.
    chipBg: alpha(ink, 0.14),
    lockup: ink === '#ffffff' ? 'light' : 'dark-text',
    panelBg,
  }
}
