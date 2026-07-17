// NOTE: the brief's original snippet used
//   import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'
// but the installed version (0.18.5) removed the `/config` subpath and the
// `defineWorkersConfig`/`defineWorkersProject` helpers entirely. Confirmed via
// `npm ls @cloudflare/vitest-pool-workers`, its package.json `exports` map
// (only ".", "./types", "./codemods/vitest-v3-to-v4"), and the bundled
// `vitest-v3-to-v4` codemod, which rewrites the old config shape into this
// Vite-plugin form: `cloudflareTest(options)` returns a Vite plugin that
// internally wires up `test.pool`/`test.poolRunner`, so it's passed via
// `plugins: []` on a standard vitest `defineConfig`.
//
// `readD1Migrations` is exported from the package root (not `/config`, which
// no longer exists — confirmed via the root `dist/pool/index.d.mts` export
// list). `cloudflareTest` also accepts an async factory function
// `(ctx) => WorkersPoolOptions | Promise<WorkersPoolOptions>`, so migrations
// are read once and exposed as a Miniflare `bindings` entry
// (`WorkersPoolOptions.miniflare.bindings: Record<string, Json>`) named
// `TEST_MIGRATIONS`, matching the ambient `Cloudflare.Env` augmentation in
// `test/env.d.ts`. `setupFiles` stays a normal Vitest `test` option — Vitest
// runs setup files inside each test file's runner context, which for this
// pool is the Miniflare worker isolate, so `cloudflare:test` resolves there.

import path from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(path.join(__dirname, 'migrations'))
      return {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }
    }),
  ],
  test: {
    setupFiles: ['./test/apply-migrations.ts'],
  },
})
