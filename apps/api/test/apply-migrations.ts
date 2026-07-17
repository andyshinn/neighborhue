import { applyD1Migrations, env } from 'cloudflare:test'

// Runs before each test file: brings the isolated per-file D1 up to schema.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
