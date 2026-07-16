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
import { defineConfig } from 'vitest/config'
import { cloudflareTest } from '@cloudflare/vitest-pool-workers'

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
    }),
  ],
})
