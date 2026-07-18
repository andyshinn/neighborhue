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
    ['#FFD700', '#181310'], // Yellow — high luminance
    ['#4B0082', '#ffffff'], // Indigo — low luminance
    ['#FDF4DC', '#181310'], // Warm White — near-white extreme
    ['#00FF00', '#181310'], // Green — 0.7152 coefficient dominates
    ['#0000FF', '#ffffff'], // Blue — 0.0722 coefficient, inverse case
    ['#808080', '#181310'], // mid-gray, just above the crossover
  ]
  for (const [hex, ink] of cases) {
    it(`${hex} → ${ink}`, () => {
      expect(colorTheme(hex).ink).toBe(ink)
    })
  }
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
    expect(t.chipBg).toBe(alpha('#181310', 0.12))
  })
})

describe('alpha', () => {
  it('renders an rgba string', () => {
    expect(alpha('#ffffff', 0.5)).toBe('rgba(255, 255, 255, 0.5)')
    expect(alpha('#181310', 0.68)).toBe('rgba(24, 19, 16, 0.68)')
  })
})
