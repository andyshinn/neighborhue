import { describe, expect, it } from 'vitest'
import { validateTimezone } from './timezone'

describe('validateTimezone', () => {
  it('accepts real IANA zones', () => {
    expect(validateTimezone('America/New_York')).toBe(true)
    expect(validateTimezone('UTC')).toBe(true)
  })
  it('rejects garbage and empty input', () => {
    expect(validateTimezone('Mars/Base')).toBe(false)
    expect(validateTimezone('')).toBe(false)
  })
})
