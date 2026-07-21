// Mirrors the API's own zone validation (luxon `IANAZone.isValidZone`, which is a
// `new Intl.DateTimeFormat({ timeZone })` try/catch): a zone is valid iff the
// runtime can build a formatter for it. This gives exact client↔API parity, so
// the form blocks only zones the API would also reject with a 400. Unlike
// `Intl.supportedValuesOf('timeZone')`, it does not reject the "UTC" alias, which
// some ICU builds omit from the enumerated list.
export function validateTimezone(tz: string): boolean {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}
