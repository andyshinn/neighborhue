import { describe, it, expect } from 'vitest'
import { isValidHex, hexToRgb, rgbToHsl, buildColor } from '../src/lib/color'

describe('isValidHex', () => {
  it('accepts #RRGGBB', () => {
    expect(isValidHex('#FF0000')).toBe(true)
    expect(isValidHex('#00ff00')).toBe(true)
  })
  it('rejects malformed values', () => {
    expect(isValidHex('#FFF')).toBe(false)
    expect(isValidHex('FF0000')).toBe(false)
    expect(isValidHex('#GG0000')).toBe(false)
  })
})

describe('hexToRgb', () => {
  it('converts known hex values', () => {
    expect(hexToRgb('#FF0000')).toEqual([255, 0, 0])
    expect(hexToRgb('#00FF00')).toEqual([0, 255, 0])
    expect(hexToRgb('#0000FF')).toEqual([0, 0, 255])
    expect(hexToRgb('#FFFFFF')).toEqual([255, 255, 255])
  })
  it('throws on invalid hex', () => {
    expect(() => hexToRgb('nope')).toThrow('invalid hex')
  })
})

describe('rgbToHsl', () => {
  it('converts known values', () => {
    expect(rgbToHsl(255, 0, 0)).toEqual([0, 100, 50])
    expect(rgbToHsl(0, 255, 0)).toEqual([120, 100, 50])
    expect(rgbToHsl(0, 0, 255)).toEqual([240, 100, 50])
    expect(rgbToHsl(255, 255, 255)).toEqual([0, 0, 100])
    expect(rgbToHsl(0, 0, 0)).toEqual([0, 0, 0])
  })
})

describe('buildColor', () => {
  it('assembles hex/rgb/hsl/name', () => {
    expect(buildColor('#FF0000', 'Red')).toEqual({
      hex: '#FF0000',
      rgb: [255, 0, 0],
      hsl: [0, 100, 50],
      name: 'Red',
    })
  })
})
