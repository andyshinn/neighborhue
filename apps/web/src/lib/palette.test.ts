import { describe, expect, it } from 'vitest'
import { type PaletteSummary, resolvePalette } from './palette'

const palettes: PaletteSummary[] = [
  {
    slug: 'rainbow',
    name: 'Rainbow Colors',
    description: 'The classic seven-color rainbow.',
    colors: [
      { hex: '#FF0000', name: 'Red' },
      { hex: '#0080FF', name: 'Blue' },
    ],
  },
]

describe('resolvePalette', () => {
  it('resolves a known slug to its display name and colors', () => {
    const r = resolvePalette('rainbow', palettes)
    expect(r).toEqual({ kind: 'curated', name: 'Rainbow Colors', colors: palettes[0].colors })
  })
  it('treats a null slug as custom colors (no swatches available publicly)', () => {
    expect(resolvePalette(null, palettes)).toEqual({ kind: 'custom' })
  })
  it('degrades gracefully for an unknown slug: shows the slug, no swatches', () => {
    // Happens if the API adds a palette while our cached list is stale.
    expect(resolvePalette('brand-new', palettes)).toEqual({ kind: 'curated', name: 'brand-new', colors: [] })
  })
})
