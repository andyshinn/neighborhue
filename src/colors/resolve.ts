import { isValidHex } from '../lib/color'

export interface ColorEntry {
  hex: string
  name: string | null
}

export interface ResolveInput {
  customColors: ColorEntry[] | null
  paletteColors: ColorEntry[] // ordered
  defaultPaletteColors: ColorEntry[] // ordered
}

// custom_colors (non-empty) wins → linked palette → default palette.
export function resolveColorList(input: ResolveInput): ColorEntry[] {
  if (input.customColors && input.customColors.length > 0) return input.customColors
  if (input.paletteColors.length > 0) return input.paletteColors
  return input.defaultPaletteColors
}

// Defensive read-side parse of the stored custom_colors JSON.
export function parseCustomColors(json: string | null): ColorEntry[] | null {
  if (!json) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  const out: ColorEntry[] = []
  for (const item of parsed) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as { hex?: unknown }).hex === 'string' &&
      isValidHex((item as { hex: string }).hex)
    ) {
      const name = (item as { name?: unknown }).name
      out.push({ hex: (item as { hex: string }).hex, name: typeof name === 'string' ? name : null })
    }
  }
  return out.length > 0 ? out : null
}
