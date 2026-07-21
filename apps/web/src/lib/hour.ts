// 0–23 → a 12-hour label like "7:00 AM". The rotation hour is always a whole
// hour, so minutes are always ":00".
export function formatHourLabel(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${h12}:00 ${period}`
}
