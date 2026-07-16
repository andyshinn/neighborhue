import { DateTime } from 'luxon'

const EPOCH = { year: 2000, month: 1, day: 1 } // fixed reference for day indexing

export interface RotationInfo {
  dayIndex: number
  rotatedAt: string
  nextRotationAt: string
  secondsUntilRotation: number
}

export function rotation(
  timezone: string,
  rotationHour: number,
  now: DateTime = DateTime.utc(),
): RotationInfo {
  const local = now.setZone(timezone)

  // The color-day starts at rotationHour local time.
  const rotationToday = local.set({ hour: rotationHour, minute: 0, second: 0, millisecond: 0 })
  const currentStart = local < rotationToday ? rotationToday.minus({ days: 1 }) : rotationToday
  const nextStart = currentStart.plus({ days: 1 }) // Luxon keeps wall-clock hour across DST

  // dayIndex from the CALENDAR date of the color-day start — whole days, DST-immune.
  const epoch = DateTime.fromObject(EPOCH, { zone: timezone })
  const dayIndex = Math.floor(currentStart.startOf('day').diff(epoch.startOf('day'), 'days').days + 0.5)

  return {
    dayIndex,
    rotatedAt: currentStart.toUTC().toISO()!,
    nextRotationAt: nextStart.toUTC().toISO()!,
    secondsUntilRotation: Math.max(0, Math.round(nextStart.diff(now, 'seconds').seconds)),
  }
}
