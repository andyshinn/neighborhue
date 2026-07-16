export const HEX_RE = /^#[0-9A-Fa-f]{6}$/

export function isValidHex(hex: string): boolean {
  return HEX_RE.test(hex)
}

export function hexToRgb(hex: string): [number, number, number] {
  if (!isValidHex(hex)) throw new Error(`invalid hex: ${hex}`)
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case rn:
        h = ((gn - bn) / d) % 6
        break
      case gn:
        h = (bn - rn) / d + 2
        break
      default:
        h = (rn - gn) / d + 4
        break
    }
    h *= 60
    if (h < 0) h += 360
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]
}

export interface Color {
  hex: string
  rgb: [number, number, number]
  hsl: [number, number, number]
  name: string | null
}

export function buildColor(hex: string, name: string | null): Color {
  const [r, g, b] = hexToRgb(hex)
  return { hex, rgb: [r, g, b], hsl: rgbToHsl(r, g, b), name }
}
