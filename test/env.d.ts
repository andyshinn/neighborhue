// NOTE: adapted from the brief. The installed `@cloudflare/vitest-pool-workers`
// (0.18.5) no longer declares `interface ProvidedEnv` inside the `cloudflare:test`
// ambient module (confirmed: no `ProvidedEnv` anywhere in the package). The
// `env` export from `cloudflare:test` is now typed as `Cloudflare.Env`, a
// global namespace (see `node_modules/@cloudflare/workers-types/index.d.ts`)
// that projects extend by declaration merging — the same interface `wrangler
// types` would generate into. `D1Migration` is also no longer exported from
// `@cloudflare/workers-types`; it now lives on `@cloudflare/vitest-pool-workers`'s
// root export.
import type { D1Migration } from '@cloudflare/vitest-pool-workers'

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database
      CORS_ORIGIN: string
      MANAGE_URL_BASE: string
      TEST_MIGRATIONS: D1Migration[]
    }
  }
}
