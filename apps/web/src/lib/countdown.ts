// Renders a remaining-seconds count as HH:MM:SS. Clamped at zero because the
// client clock can run ahead of the server's rotation moment (spec S8).
export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
}
