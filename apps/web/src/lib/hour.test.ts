import { describe, expect, it } from 'vitest'
import { formatHourLabel } from './hour'

describe('formatHourLabel', () => {
  it('formats midnight and noon', () => {
    expect(formatHourLabel(0)).toBe('12:00 AM')
    expect(formatHourLabel(12)).toBe('12:00 PM')
  })
  it('formats morning and evening hours', () => {
    expect(formatHourLabel(7)).toBe('7:00 AM')
    expect(formatHourLabel(23)).toBe('11:00 PM')
  })
})
