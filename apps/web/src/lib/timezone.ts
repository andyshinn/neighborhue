// `Intl.supportedValuesOf` is ES2022 runtime but not in the TS ES2022 lib types;
// widen locally rather than pulling in lib.esnext.
type IntlWithSupported = typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] }

// Validates an IANA zone the same way the API does in spirit: a membership check
// against the runtime's zone list, falling back to constructing a formatter
// (throws RangeError on an unknown zone) where the enumeration API is missing
// or doesn't list the zone — e.g. V8's supportedValuesOf('timeZone') omits the
// "UTC" alias even though Intl.DateTimeFormat accepts it as a valid time zone.
export function validateTimezone(tz: string): boolean {
  if (!tz) return false
  const intl = Intl as IntlWithSupported
  if (typeof intl.supportedValuesOf === 'function' && intl.supportedValuesOf('timeZone').includes(tz)) {
    return true
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}
