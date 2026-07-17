import { describe, expect, it } from 'vitest'
import { parseCustomColors, resolveColorList } from '../src/colors/resolve'

describe('resolveColorList', () => {
  const palette = [{ hex: '#111111', name: 'p' }]
  const def = [{ hex: '#222222', name: 'd' }]

  it('prefers non-empty custom colors', () => {
    const custom = [{ hex: '#FF0000', name: 'c' }]
    expect(resolveColorList({ customColors: custom, paletteColors: palette, defaultPaletteColors: def })).toBe(custom)
  })
  it('falls back to the linked palette when custom is null', () => {
    expect(resolveColorList({ customColors: null, paletteColors: palette, defaultPaletteColors: def })).toBe(palette)
  })
  it('falls back to the default palette when custom and palette are empty', () => {
    expect(resolveColorList({ customColors: null, paletteColors: [], defaultPaletteColors: def })).toBe(def)
  })
})

describe('parseCustomColors', () => {
  it('returns null for null/empty/whitespace', () => {
    expect(parseCustomColors(null)).toBeNull()
    expect(parseCustomColors('[]')).toBeNull()
  })
  it('parses valid entries and defaults name to null', () => {
    expect(parseCustomColors('[{"hex":"#FF0000","name":"Red"},{"hex":"#00FF00"}]')).toEqual([
      { hex: '#FF0000', name: 'Red' },
      { hex: '#00FF00', name: null },
    ])
  })
  it('drops invalid hex entries and returns null if none remain', () => {
    expect(parseCustomColors('[{"hex":"nope"}]')).toBeNull()
  })
  it('returns null for malformed json', () => {
    expect(parseCustomColors('{not json')).toBeNull()
  })
})
