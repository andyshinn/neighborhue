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
