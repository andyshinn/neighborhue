import { describe, expect, it } from 'vitest'
import { pickColorIndex } from '../src/lib/pick'

describe('pickColorIndex', () => {
  it('is deterministic for the same (id, dayIndex, n)', () => {
    expect(pickColorIndex('nb1', 42, 7)).toBe(pickColorIndex('nb1', 42, 7))
  })

  it('returns 0 when there is a single color', () => {
    expect(pickColorIndex('nb1', 12345, 1)).toBe(0)
  })

  it('throws when the color list is empty', () => {
    expect(() => pickColorIndex('nb1', 0, 0)).toThrow('empty color list')
  })

  it('always returns an index within range', () => {
    for (let d = 0; d < 200; d++) {
      const idx = pickColorIndex('nb1', d, 7)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(7)
    }
  })

  it('yields each index exactly once within a cycle-aligned window of n days', () => {
    const n = 7
    for (let cycle = 0; cycle < 5; cycle++) {
      const start = cycle * n
      const seen = new Set<number>()
      for (let d = start; d < start + n; d++) seen.add(pickColorIndex('nb1', d, n))
      expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6])
    }
  })

  it('uses different orders across neighborhoods (variation on a fixed day)', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const values = new Set(ids.map((id) => pickColorIndex(id, 100, 7)))
    expect(values.size).toBeGreaterThan(1)
  })
})
