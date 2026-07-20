import { describe, expect, it } from 'vitest'
import { formatCountdown } from './countdown'

describe('formatCountdown', () => {
  it('zero-pads hours, minutes and seconds', () => {
    expect(formatCountdown(0)).toBe('00:00:00')
    expect(formatCountdown(61)).toBe('00:01:01')
    expect(formatCountdown(3661)).toBe('01:01:01')
    expect(formatCountdown(86399)).toBe('23:59:59')
  })
  it('clamps negatives to zero (client clock ahead of the server)', () => {
    expect(formatCountdown(-5)).toBe('00:00:00')
  })
  it('does not wrap past 24 hours', () => {
    expect(formatCountdown(90000)).toBe('25:00:00')
  })
  it('floors fractional seconds', () => {
    expect(formatCountdown(59.9)).toBe('00:00:59')
  })
})
