import { describe, expect, it } from 'vitest'
import { ifNoneMatchSatisfied, weakEtag } from '../src/lib/etag'

describe('weakEtag', () => {
  it('is a weak validator wrapping 16 lowercase hex digits', async () => {
    expect(await weakEtag('hello')).toMatch(/^W\/"[0-9a-f]{16}"$/)
  })

  it('is the first 16 hex digits of the SHA-256 of the body', async () => {
    // SHA-256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    expect(await weakEtag('hello')).toBe('W/"2cf24dba5fb0a30e"')
  })

  it('gives the same body the same validator', async () => {
    expect(await weakEtag('same')).toBe(await weakEtag('same'))
  })

  it('gives different bodies different validators', async () => {
    expect(await weakEtag('a')).not.toBe(await weakEtag('b'))
  })

  it('moves when a single nested field changes', async () => {
    const body = { color: { hex: '#E4572E' }, day_index: 9692 }
    const repainted = { color: { hex: '#2E4FE4' }, day_index: 9692 }
    expect(await weakEtag(JSON.stringify(body))).not.toBe(await weakEtag(JSON.stringify(repainted)))
  })

  it('moves when only day_index changes', async () => {
    const today = { color: { hex: '#E4572E' }, day_index: 9692 }
    const tomorrow = { color: { hex: '#E4572E' }, day_index: 9693 }
    expect(await weakEtag(JSON.stringify(today))).not.toBe(await weakEtag(JSON.stringify(tomorrow)))
  })
})

describe('ifNoneMatchSatisfied', () => {
  const tag = 'W/"0123456789abcdef"'

  it('is unsatisfied when the header is absent', () => {
    expect(ifNoneMatchSatisfied(undefined, tag)).toBe(false)
  })

  it('matches the exact tag the server sent', () => {
    expect(ifNoneMatchSatisfied(tag, tag)).toBe(true)
  })

  it('matches the strong form of the same tag, per weak comparison', () => {
    // RFC 9110 §13.1.2: If-None-Match uses the weak comparison function, so a
    // client (or intermediary) that dropped the W/ prefix still matches.
    expect(ifNoneMatchSatisfied('"0123456789abcdef"', tag)).toBe(true)
  })

  it('matches when the tag is one entry in a list', () => {
    expect(ifNoneMatchSatisfied(`W/"aaaaaaaaaaaaaaaa", ${tag}, W/"bbbbbbbbbbbbbbbb"`, tag)).toBe(true)
  })

  it('matches the wildcard', () => {
    expect(ifNoneMatchSatisfied('*', tag)).toBe(true)
  })

  it('does not match a stale tag', () => {
    expect(ifNoneMatchSatisfied('W/"ffffffffffffffff"', tag)).toBe(false)
  })
})
