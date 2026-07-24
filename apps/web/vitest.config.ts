import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    // Vitest's default `css: false` empties the content of *any* module whose id
    // matches a CSS extension — even `?raw`/`?inline` imports — regardless of
    // query. tokens.test.ts reads tokens.css via `?raw`, so it needs real
    // processing; every other .module.css import in the suite keeps using
    // Vitest's default class-name-proxy stub (untouched by this include).
    css: {
      include: [/tokens\.css/],
    },
  },
})
