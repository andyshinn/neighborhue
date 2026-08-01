import { describe, expect, it } from 'vitest'
import { alpha, colorTheme, relativeLuminance } from './theme'

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
  })
})

describe('colorTheme ink — seeded-palette fixtures', () => {
  // hex, expected ink, why it's a good test (spec §9.1)
  const cases: Array<[string, '#181310' | '#ffffff']> = [
    ['#FFD700', '#181310'], // Yellow — high luminance, past reach of darkening
    ['#4B0082', '#ffffff'], // Indigo — low luminance, white clears outright
    ['#FDF4DC', '#181310'], // Warm White — near-white extreme
    ['#00FF00', '#181310'], // Green — 0.7152 coefficient dominates
    ['#0000FF', '#ffffff'], // Blue — 0.0722 coefficient, inverse case
    ['#808080', '#ffffff'], // mid-gray — reachable by darkening, so white wins
  ]
  for (const [hex, ink] of cases) {
    it(`${hex} → ${ink}`, () => {
      expect(colorTheme(hex).ink).toBe(ink)
    })
  }
})

// The rule that replaced naive max-contrast. Naive contrast puts BLACK on
// #0080FF (5.5:1 vs white's 3.8:1) — legible and visually wrong. These are the
// three branches, and the guarantee that ties them together.
describe('colorTheme ink — white-first with a darkening budget', () => {
  it('leaves genuinely dark hues untouched and inks them white', () => {
    const t = colorTheme('#7A3CFF')
    expect(t.ink).toBe('#ffffff')
    expect(t.panelBg).toBe('#7A3CFF')
  })

  it('darkens a saturated mid-tone just enough to carry white ink', () => {
    const t = colorTheme('#0080FF')
    expect(t.ink).toBe('#ffffff')
    expect(t.lockup).toBe('light')
    expect(t.panelBg).not.toBe('#0080FF')
    expect(relativeLuminance(t.panelBg)).toBeLessThan(relativeLuminance('#0080FF'))
    // Within the budget: the panel must still read as the blue it claims to be.
    expect(relativeLuminance(t.panelBg)).toBeGreaterThan(relativeLuminance('#0080FF') * 0.6)
  })

  it('keeps light hues true and switches the ink instead', () => {
    for (const hex of ['#FFEA00', '#FFC400', '#22C55E']) {
      const t = colorTheme(hex)
      expect(t.ink).toBe('#181310')
      expect(t.lockup).toBe('dark-text')
      expect(t.panelBg).toBe(hex) // never darkened — we gave up on white instead
    }
  })

  it('never darkens a panel it did not need to darken', () => {
    for (const hex of ['#000000', '#4B0082', '#7A3CFF', '#FFEA00', '#FFFFFF']) {
      expect(colorTheme(hex).panelBg).toBe(hex)
    }
  })

  it('always reaches AA for the ink it chose', () => {
    const contrast = (bg: string, fg: string) => {
      const [a, b] = [relativeLuminance(bg), relativeLuminance(fg)].sort((x, y) => y - x)
      return (a + 0.05) / (b + 0.05)
    }
    for (const hex of ['#0080FF', '#FF2D2D', '#7A3CFF', '#FFEA00', '#22C55E', '#808080', '#FDF4DC']) {
      const t = colorTheme(hex)
      expect(contrast(t.panelBg, t.ink)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('colorTheme derived fields', () => {
  it('chooses the light lockup on dark backgrounds (white ink)', () => {
    expect(colorTheme('#4B0082').lockup).toBe('light')
  })
  it('chooses the dark-text lockup on light backgrounds (dark ink)', () => {
    expect(colorTheme('#FFD700').lockup).toBe('dark-text')
  })
  it('muted and chip derive from the ink color', () => {
    const t = colorTheme('#FFD700')
    expect(t.inkMuted).toBe(alpha('#181310', 0.68))
    expect(t.chipBg).toBe(alpha('#181310', 0.14))
  })
})

describe('alpha', () => {
  it('renders an rgba string', () => {
    expect(alpha('#ffffff', 0.5)).toBe('rgba(255, 255, 255, 0.5)')
    expect(alpha('#181310', 0.68)).toBe('rgba(24, 19, 16, 0.68)')
  })
})
