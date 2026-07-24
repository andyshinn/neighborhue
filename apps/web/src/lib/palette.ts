export interface PaletteColor {
  hex: string
  name: string | null
}

export interface PaletteSummary {
  slug: string
  name: string
  description: string | null
  is_default: boolean
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

// The Home hero's example card (2d H1). It is an illustration drawn from the
// real default palette — never a claim about today's color, which only the
// server can choose. Returns null when there is nothing safe to draw: no
// palettes (the fetch is allowed to fail, H9) or a palette with no colors.
export interface HeroPalette {
  name: string
  colors: PaletteColor[]
}

export function toHeroPalette(palettes: PaletteSummary[]): HeroPalette | null {
  const summary = palettes.find((p) => p.is_default) ?? palettes[0]
  if (!summary || summary.colors.length === 0) return null
  return { name: summary.name, colors: summary.colors }
}
