// TODO(Task 10): re-point this to `import type { NeighborhoodRow } from './db/queries'`
// once src/db/queries.ts exists, and delete the temporary type alias below.
// import type { NeighborhoodRow } from './db/queries'

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

export type NeighborhoodRow = Record<string, unknown>
