import { describe, expect, it } from 'vitest'
import { newAdminSecret, newNeighborhoodId } from '../src/lib/ids'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newNeighborhoodId', () => {
  it('returns a UUID v4', () => {
    expect(newNeighborhoodId()).toMatch(UUID_RE)
  })
  it('is unique across calls', () => {
    expect(newNeighborhoodId()).not.toBe(newNeighborhoodId())
  })
})

describe('newAdminSecret', () => {
  it('has the nh_sk_ prefix and base64url body of >= 32 bytes', () => {
    const s = newAdminSecret()
    expect(s.startsWith('nh_sk_')).toBe(true)
    const body = s.slice('nh_sk_'.length)
    expect(body).toMatch(/^[A-Za-z0-9_-]+$/)
    // 32 bytes -> 43 base64url chars (unpadded)
    expect(body.length).toBeGreaterThanOrEqual(43)
  })
  it('is unique across calls', () => {
    expect(newAdminSecret()).not.toBe(newAdminSecret())
  })
})
