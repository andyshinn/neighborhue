import type { NeighborhoodRow } from './db/queries'
import type { Color } from './lib/color'

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
//
// PublicColor is the API's own `Color` (single source — no duplication), and
// the GET /:id handler asserts `satisfies PublicNeighborhood`, so producer-side
// drift fails the API's own typecheck rather than only surfacing downstream.
export type PublicColor = Color
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

// Shape returned by POST /v1/neighborhoods (201). Carries the one-time
// admin_secret and the assembled manage_url, which the public read never
// exposes. Exported so apps/web imports (not restates) it — a field rename
// here then fails apps/web typecheck, keeping the compile-time seam.
export interface CreatedNeighborhood {
  id: string
  admin_secret: string
  manage_url: string
  name: string | null
  timezone: string
  rotation_hour: number
  palette: string | null
  custom_colors: null
}
