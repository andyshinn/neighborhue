import type { PublicNeighborhood } from '@neighborhue/api/types'
import { type PaletteColor, type PaletteSummary, resolvePalette } from './palette'

/**
 * Everything the Home hero card draws, in one shape, so the card component
 * never has to ask which of its two sources it is looking at.
 *
 * `live` is the distinction that matters. A live example is a real reading of a
 * real neighborhood: its color, its countdown, its share page to link to. A
 * fallback is an illustration — no id (so no link is offered), and no rotation
 * timestamp from the server.
 */
export interface HeroExample {
  live: boolean
  /** Present only when live — the target of both "live example" links. */
  id: string | null
  name: string
  hex: string
  colorName: string
  paletteName: string
  colors: PaletteColor[]
  rotationHour: number
  /** Server-rendered countdown seed. Meaningless unless nextRotationAt is set. */
  seconds: number
  /** Absolute rotation moment. Null on the fallback — the card supplies its own. */
  nextRotationAt: string | null
}

// Rainbow's Blue, at the default 7am. Chosen over the palette's first color
// (pure red) because it is calmer at hero scale, and because it exercises the
// ink rule's interesting branch: white ink on a slightly darkened blue.
export const FALLBACK_EXAMPLE: HeroExample = {
  live: false,
  id: null,
  name: 'Maple Street',
  hex: '#0080FF',
  colorName: 'Blue',
  paletteName: 'Rainbow',
  // Verbatim from the API's rainbow seed (apps/api/seed/palettes.ts), so the
  // offline illustration shows the same swatches the live card would.
  colors: [
    { hex: '#FF0000', name: 'Red' },
    { hex: '#FF8000', name: 'Orange' },
    { hex: '#FFD700', name: 'Yellow' },
    { hex: '#00FF00', name: 'Green' },
    { hex: '#0080FF', name: 'Blue' },
    { hex: '#4B0082', name: 'Indigo' },
    { hex: '#8000FF', name: 'Violet' },
  ],
  rotationHour: 7,
  seconds: 0,
  nextRotationAt: null,
}

/**
 * A real neighborhood → the hero card's model.
 *
 * The public read returns a palette SLUG only, so the display name and the
 * swatch row come from the palettes list; a neighborhood on custom colors
 * exposes neither, and gets a name with an empty row rather than a wrong one.
 */
export function toHeroExample(neighborhood: PublicNeighborhood, palettes: PaletteSummary[]): HeroExample {
  const palette = resolvePalette(neighborhood.palette, palettes)
  return {
    live: true,
    id: neighborhood.id,
    name: neighborhood.name ?? 'This neighborhood',
    hex: neighborhood.color.hex,
    colorName: neighborhood.color.name ?? neighborhood.color.hex,
    paletteName: palette.kind === 'custom' ? 'Custom colors' : palette.name,
    colors: palette.kind === 'custom' ? [] : palette.colors,
    rotationHour: neighborhood.rotation_hour,
    seconds: neighborhood.seconds_until_rotation,
    nextRotationAt: neighborhood.next_rotation_at,
  }
}

/**
 * The next occurrence of `hour` in the VIEWER's local time, as an ISO string.
 *
 * Only the fallback card uses this, and only after mount: with no server
 * reading to count toward, the illustration counts toward the next 7am where
 * the reader is — which is exactly what a 7am-rotating neighborhood would do.
 * Must not run during SSR; the server's zone is not the reader's, and the two
 * renders would disagree.
 */
export function nextLocalOccurrence(hour: number, now: Date = new Date()): string {
  const target = new Date(now)
  target.setHours(hour, 0, 0, 0)
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1)
  return target.toISOString()
}
