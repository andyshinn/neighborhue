import type { PublicNeighborhood } from '@neighborhue/api/types'
import { describe, expect, it } from 'vitest'
import { FALLBACK_EXAMPLE, nextLocalOccurrence, toHeroExample } from './heroExample'
import type { PaletteSummary } from './palette'

const palettes: PaletteSummary[] = [
  {
    slug: 'rainbow',
    name: 'Rainbow',
    description: 'The classic seven-color rainbow.',
    is_default: true,
    colors: [
      { hex: '#FF0000', name: 'Red' },
      { hex: '#0080FF', name: 'Blue' },
    ],
  },
]

const neighborhood: PublicNeighborhood = {
  id: 'abc-123',
  name: 'Maple Street',
  timezone: 'America/New_York',
  rotation_hour: 7,
  color: { hex: '#0080FF', rgb: [0, 128, 255], hsl: [210, 100, 50], name: 'Blue' },
  rotated_at: '2026-08-01T11:00:00.000Z',
  next_rotation_at: '2026-08-02T11:00:00.000Z',
  seconds_until_rotation: 3661,
  palette: 'rainbow',
  day_index: 42,
}

describe('toHeroExample', () => {
  it('carries the server reading through verbatim', () => {
    const e = toHeroExample(neighborhood, palettes)
    expect(e).toMatchObject({
      live: true,
      id: 'abc-123',
      name: 'Maple Street',
      hex: '#0080FF',
      colorName: 'Blue',
      paletteName: 'Rainbow',
      rotationHour: 7,
      seconds: 3661,
      nextRotationAt: '2026-08-02T11:00:00.000Z',
    })
    expect(e.colors).toEqual(palettes[0].colors)
  })

  it('names an unnamed neighborhood without inventing one', () => {
    expect(toHeroExample({ ...neighborhood, name: null }, palettes).name).toBe('This neighborhood')
  })

  it('falls back to the hex when the color has no name', () => {
    const noName = { ...neighborhood, color: { ...neighborhood.color, name: null } }
    expect(toHeroExample(noName, palettes).colorName).toBe('#0080FF')
  })

  // The public read never exposes custom colors, so there is a name to show but
  // no swatches — an empty row beats a wrong one.
  it('labels custom colors and shows no swatches for them', () => {
    const e = toHeroExample({ ...neighborhood, palette: null }, palettes)
    expect(e.paletteName).toBe('Custom colors')
    expect(e.colors).toEqual([])
  })

  it('still resolves when the cached palette list is stale', () => {
    const e = toHeroExample({ ...neighborhood, palette: 'brand-new' }, palettes)
    expect(e.paletteName).toBe('brand-new')
    expect(e.colors).toEqual([])
  })
})

describe('FALLBACK_EXAMPLE', () => {
  // Everything that gates a link or a disclaimer keys off these two fields.
  it('is marked as an illustration with nothing to link to', () => {
    expect(FALLBACK_EXAMPLE.live).toBe(false)
    expect(FALLBACK_EXAMPLE.id).toBeNull()
    expect(FALLBACK_EXAMPLE.nextRotationAt).toBeNull()
  })

  it('draws real swatches so the offline card is not obviously fake', () => {
    expect(FALLBACK_EXAMPLE.colors).toHaveLength(7)
    expect(FALLBACK_EXAMPLE.colors.map((c) => c.hex)).toContain(FALLBACK_EXAMPLE.hex)
  })
})

describe('nextLocalOccurrence', () => {
  it('returns today when the hour is still ahead', () => {
    const now = new Date(2026, 7, 1, 5, 30)
    expect(nextLocalOccurrence(7, now)).toBe(new Date(2026, 7, 1, 7, 0, 0, 0).toISOString())
  })

  it('rolls to tomorrow once the hour has passed', () => {
    const now = new Date(2026, 7, 1, 9, 30)
    expect(nextLocalOccurrence(7, now)).toBe(new Date(2026, 7, 2, 7, 0, 0, 0).toISOString())
  })

  // Exactly on the hour has already rotated, so the next one is tomorrow's.
  it('rolls forward when it lands exactly on the hour', () => {
    const now = new Date(2026, 7, 1, 7, 0, 0, 0)
    expect(nextLocalOccurrence(7, now)).toBe(new Date(2026, 7, 2, 7, 0, 0, 0).toISOString())
  })
})
