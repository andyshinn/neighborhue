import { describe, expect, it } from 'vitest'
import { mulberry32, strHash } from '../src/lib/hash'

describe('strHash', () => {
  it('is deterministic', () => {
    expect(strHash('abc:0')).toBe(strHash('abc:0'))
  })
  it('returns an unsigned 32-bit integer', () => {
    const h = strHash('anything')
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThanOrEqual(0xffffffff)
    expect(Number.isInteger(h)).toBe(true)
  })
  it('differs for different inputs', () => {
    expect(strHash('a')).not.toBe(strHash('b'))
  })
})

describe('mulberry32', () => {
  it('produces a deterministic sequence for a seed', () => {
    const a = mulberry32(123)
    const b = mulberry32(123)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('produces floats in [0, 1)', () => {
    const r = mulberry32(999)
    for (let i = 0; i < 100; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
