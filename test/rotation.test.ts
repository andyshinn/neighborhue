import { describe, it, expect } from 'vitest'
import { DateTime } from 'luxon'
import { rotation } from '../src/lib/rotation'

const CHI = 'America/Chicago'

describe('rotation', () => {
  it('before rotationHour local, the color-day is yesterday', () => {
    // 06:00 local in Chicago on 2026-07-15 (CDT = UTC-5) => 11:00 UTC
    const now = DateTime.fromISO('2026-07-15T11:00:00.000Z', { zone: 'utc' })
    const info = rotation(CHI, 7, now)
    // color-day started 2026-07-14T07:00 local => 12:00 UTC
    expect(info.rotatedAt).toBe('2026-07-14T12:00:00.000Z')
    expect(info.nextRotationAt).toBe('2026-07-15T12:00:00.000Z')
  })

  it('at/after rotationHour local, the color-day is today', () => {
    // 08:00 local in Chicago on 2026-07-15 => 13:00 UTC
    const now = DateTime.fromISO('2026-07-15T13:00:00.000Z', { zone: 'utc' })
    const info = rotation(CHI, 7, now)
    expect(info.rotatedAt).toBe('2026-07-15T12:00:00.000Z')
    expect(info.nextRotationAt).toBe('2026-07-16T12:00:00.000Z')
  })

  it('dayIndex matches the spec sample for 2026-07-15', () => {
    const now = DateTime.fromISO('2026-07-15T13:00:00.000Z', { zone: 'utc' })
    expect(rotation(CHI, 7, now).dayIndex).toBe(9692)
  })

  it('dayIndex increments by exactly 1 the next color-day', () => {
    const d1 = rotation(CHI, 7, DateTime.fromISO('2026-07-15T13:00:00.000Z', { zone: 'utc' }))
    const d2 = rotation(CHI, 7, DateTime.fromISO('2026-07-16T13:00:00.000Z', { zone: 'utc' }))
    expect(d2.dayIndex - d1.dayIndex).toBe(1)
  })

  it('keeps the same wall-clock hour across spring-forward (gap is 23h)', () => {
    // US spring-forward 2026-03-08. Evaluate just after the 07:00 rotation on the 8th.
    const now = DateTime.fromISO('2026-03-08T14:00:00.000Z', { zone: 'utc' })
    const info = rotation(CHI, 7, now)
    const start = DateTime.fromISO(info.rotatedAt)
    const next = DateTime.fromISO(info.nextRotationAt)
    // Both are 07:00 local; the real gap is 23 hours across spring-forward.
    expect(next.diff(start, 'hours').hours).toBeCloseTo(23, 5)
    expect(start.setZone(CHI).hour).toBe(7)
    expect(next.setZone(CHI).hour).toBe(7)
  })

  it('keeps the same wall-clock hour across fall-back (gap is 25h)', () => {
    // US fall-back 2026-11-01. Evaluate just after the 07:00 rotation on the 1st.
    const now = DateTime.fromISO('2026-11-01T14:00:00.000Z', { zone: 'utc' })
    const info = rotation(CHI, 7, now)
    const start = DateTime.fromISO(info.rotatedAt)
    const next = DateTime.fromISO(info.nextRotationAt)
    expect(next.diff(start, 'hours').hours).toBeCloseTo(25, 5)
    expect(next.setZone(CHI).hour).toBe(7)
  })

  it('secondsUntilRotation is positive and matches next_rotation_at - now', () => {
    const now = DateTime.fromISO('2026-07-15T13:00:00.000Z', { zone: 'utc' })
    const info = rotation(CHI, 7, now)
    const expected = Math.round(DateTime.fromISO(info.nextRotationAt).diff(now, 'seconds').seconds)
    expect(info.secondsUntilRotation).toBe(expected)
    expect(info.secondsUntilRotation).toBeGreaterThan(0)
  })
})
