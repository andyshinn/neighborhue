export interface PaletteColor {
  hex: string
  name: string | null
}

export interface PaletteSummary {
  slug: string
  name: string
  description: string | null
  colors: PaletteColor[]
}

export type ResolvedPalette = { kind: 'curated'; name: string; colors: PaletteColor[] } | { kind: 'custom' }

// The public read returns only a palette SLUG, so the display name and swatch
// colors come from GET /v1/palettes (spec S3). A null slug means the
// neighborhood is on custom colors, which the public endpoint does not expose —
// so there are no swatches to show.
export function resolvePalette(slug: string | null, palettes: PaletteSummary[]): ResolvedPalette {
  if (!slug) return { kind: 'custom' }
  const found = palettes.find((p) => p.slug === slug)
  if (!found) return { kind: 'curated', name: slug, colors: [] }
  return { kind: 'curated', name: found.name, colors: found.colors }
}
