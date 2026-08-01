// seed/palettes.ts
import type { DB } from '../src/db/client'
import { paletteColors, palettes } from '../src/db/schema'

export interface SeedColor {
  hex: string
  name: string
}
export interface SeedPalette {
  slug: string
  name: string
  description: string
  isDefault?: boolean
  colors: SeedColor[]
}

export const PALETTES: SeedPalette[] = [
  {
    slug: 'rainbow',
    name: 'Rainbow',
    description: 'The classic seven-color rainbow.',
    isDefault: true,
    colors: [
      { hex: '#FF0000', name: 'Red' },
      { hex: '#FF8000', name: 'Orange' },
      { hex: '#FFD700', name: 'Yellow' },
      { hex: '#00FF00', name: 'Green' },
      { hex: '#0080FF', name: 'Blue' },
      { hex: '#4B0082', name: 'Indigo' },
      { hex: '#8000FF', name: 'Violet' },
    ],
  },
  {
    slug: 'rainbow-warm-white',
    name: 'Rainbow + Warm White',
    description: 'The rainbow plus a warm white (best on RGBW/CCT bulbs).',
    colors: [
      { hex: '#FF0000', name: 'Red' },
      { hex: '#FF8000', name: 'Orange' },
      { hex: '#FFD700', name: 'Yellow' },
      { hex: '#00FF00', name: 'Green' },
      { hex: '#0080FF', name: 'Blue' },
      { hex: '#4B0082', name: 'Indigo' },
      { hex: '#8000FF', name: 'Violet' },
      { hex: '#FDF4DC', name: 'Warm White' },
    ],
  },
  {
    slug: 'mixed',
    name: 'Mixed (Surprise)',
    description: 'A broad, high-saturation spread across the wheel — the "surprise me" set.',
    colors: [
      { hex: '#FF0000', name: 'Red' },
      { hex: '#FF4D00', name: 'Vermilion' },
      { hex: '#FF9900', name: 'Orange' },
      { hex: '#FFE600', name: 'Gold' },
      { hex: '#CCFF00', name: 'Chartreuse' },
      { hex: '#80FF00', name: 'Lime' },
      { hex: '#33FF00', name: 'Bright Green' },
      { hex: '#00FF1A', name: 'Green' },
      { hex: '#00FF66', name: 'Spring Green' },
      { hex: '#00FFB3', name: 'Aquamarine' },
      { hex: '#00FFFF', name: 'Cyan' },
      { hex: '#00B3FF', name: 'Sky Blue' },
      { hex: '#0066FF', name: 'Azure' },
      { hex: '#001AFF', name: 'Blue' },
      { hex: '#3300FF', name: 'Indigo' },
      { hex: '#8000FF', name: 'Violet' },
      { hex: '#CC00FF', name: 'Purple' },
      { hex: '#FF00E6', name: 'Magenta' },
      { hex: '#FF0099', name: 'Rose' },
      { hex: '#FF004D', name: 'Crimson' },
    ],
  },
  {
    slug: 'vivid',
    name: 'Vivid / Neon',
    description: 'Max-saturation brights.',
    colors: [
      { hex: '#FF073A', name: 'Electric Red' },
      { hex: '#FF6700', name: 'Electric Orange' },
      { hex: '#FFF700', name: 'Electric Yellow' },
      { hex: '#39FF14', name: 'Electric Green' },
      { hex: '#00FFFF', name: 'Electric Cyan' },
      { hex: '#3D5AFF', name: 'Electric Blue' },
      { hex: '#BC13FE', name: 'Electric Purple' },
      { hex: '#FF10F0', name: 'Electric Magenta' },
      { hex: '#FF3CAC', name: 'Electric Pink' },
    ],
  },
  {
    slug: 'warm',
    name: 'Warm',
    description: 'Reds, oranges, ambers, and warm pinks.',
    colors: [
      { hex: '#FF0000', name: 'Red' },
      { hex: '#FF3300', name: 'Scarlet' },
      { hex: '#FF6600', name: 'Orange' },
      { hex: '#FF9900', name: 'Amber' },
      { hex: '#FFCC00', name: 'Gold' },
      { hex: '#FF0066', name: 'Raspberry' },
      { hex: '#FF00AA', name: 'Warm Magenta' },
      { hex: '#FF1493', name: 'Deep Pink' },
    ],
  },
  {
    slug: 'cool',
    name: 'Cool',
    description: 'Blues, teals, greens, and violets.',
    colors: [
      { hex: '#00FF00', name: 'Green' },
      { hex: '#00FF99', name: 'Spring Green' },
      { hex: '#00FFCC', name: 'Turquoise' },
      { hex: '#00FFFF', name: 'Cyan' },
      { hex: '#0099FF', name: 'Sky Blue' },
      { hex: '#0033FF', name: 'Blue' },
      { hex: '#6600FF', name: 'Indigo' },
      { hex: '#9900FF', name: 'Violet' },
    ],
  },
  {
    slug: 'primary',
    name: 'Primary & Secondary',
    description: 'Pure additive colors — highest reproduction fidelity.',
    colors: [
      { hex: '#FF0000', name: 'Red' },
      { hex: '#00FF00', name: 'Green' },
      { hex: '#0000FF', name: 'Blue' },
      { hex: '#FFFF00', name: 'Yellow' },
      { hex: '#00FFFF', name: 'Cyan' },
      { hex: '#FF00FF', name: 'Magenta' },
    ],
  },
]

// Idempotent: safe to run repeatedly. Deterministic ids make re-seeds no-ops via
// onConflictDoNothing (INSERT OR IGNORE), so a row that already exists is left as-is.
// IMPORTANT: this means editing an existing palette's colors/name/description in
// PALETTES above will NOT update rows already written to a database that has been
// seeded before — onConflictDoNothing skips the conflicting insert rather than
// updating it. Changing already-seeded palette data requires a migration (or a
// manual UPDATE/DELETE), not just a re-run of seed:local / seed:remote.
export async function seedPalettes(db: DB): Promise<void> {
  for (const p of PALETTES) {
    const paletteId = `pal_${p.slug}`
    await db
      .insert(palettes)
      .values({
        id: paletteId,
        slug: p.slug,
        name: p.name,
        description: p.description,
        isDefault: p.isDefault ?? false,
        isActive: true,
      })
      .onConflictDoNothing()
    for (let i = 0; i < p.colors.length; i++) {
      await db
        .insert(paletteColors)
        .values({
          id: `${p.slug}-${i}`,
          paletteId,
          hex: p.colors[i].hex,
          name: p.colors[i].name,
          position: i,
        })
        .onConflictDoNothing()
    }
  }
}
