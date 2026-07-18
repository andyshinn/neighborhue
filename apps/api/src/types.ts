import type { NeighborhoodRow } from './db/queries'

export type AppEnv = {
  Bindings: {
    DB: D1Database
    CORS_ORIGIN: string
    MANAGE_URL_BASE: string
  }
  Variables: {
    neighborhood: NeighborhoodRow
  }
}

// Shape returned by GET /v1/neighborhoods/:id in the default JSON format.
// Exported so apps/web can restore a real type over hc's `unknown` — that
// route also returns text (?format=hex|rgb) and a 304, which collapses
// `.json()`'s inference. Importing THIS (rather than restating it) keeps the
// type seam: rename a field here and apps/web fails `tsc` (verified).
export interface PublicColor {
  hex: string
  rgb: [number, number, number]
  hsl: [number, number, number]
  name: string | null
}
export interface PublicNeighborhood {
  id: string
  name: string | null
  timezone: string
  rotation_hour: number
  color: PublicColor
  rotated_at: string
  next_rotation_at: string
  seconds_until_rotation: number
  palette: string | null
  day_index: number
}
