import { describe, expect, it } from 'vitest'
import { validateHex } from './hex'

describe('validateHex', () => {
  it('accepts 6-digit hex (either case)', () => {
    expect(validateHex('#FF6A00')).toBe(true)
    expect(validateHex('#ff6a00')).toBe(true)
  })
  it('rejects 3-digit shorthand, missing hash, and garbage', () => {
    expect(validateHex('#F60')).toBe(false)
    expect(validateHex('FF6A00')).toBe(false)
    expect(validateHex('#GG6A00')).toBe(false)
    expect(validateHex('')).toBe(false)
  })
})
