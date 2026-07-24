import { describe, expect, it } from 'vitest'
import { type PaletteSummary, resolvePalette, toHeroPalette } from './palette'

const palettes: PaletteSummary[] = [
  {
    slug: 'rainbow',
    name: 'Rainbow Colors',
    description: 'The classic seven-color rainbow.',
    is_default: true,
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

describe('toHeroPalette', () => {
  const rainbow = {
    slug: 'rainbow',
    name: 'Rainbow Colors',
    description: null,
    is_default: true,
    colors: [{ hex: '#FF0000', name: 'Red' }],
  }
  const cool = {
    slug: 'cool',
    name: 'Cool',
    description: null,
    is_default: false,
    colors: [{ hex: '#2E6BFF', name: 'Cornflower' }],
  }

  it('prefers the default palette', () => {
    expect(toHeroPalette([cool, rainbow])).toEqual({ name: 'Rainbow Colors', colors: rainbow.colors })
  })

  it('falls back to the first palette when none is marked default', () => {
    expect(toHeroPalette([cool])).toEqual({ name: 'Cool', colors: cool.colors })
  })

  // The palettes fetch is allowed to fail (H9) and a malformed palette must not
  // reach the hero, where picking a color would divide by zero.
  it('returns null when there are no palettes', () => {
    expect(toHeroPalette([])).toBeNull()
  })

  it('returns null when the chosen palette has no colors', () => {
    expect(toHeroPalette([{ ...rainbow, colors: [] }])).toBeNull()
  })
})
