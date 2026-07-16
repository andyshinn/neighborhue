# Neighborhue Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Neighborhue API — a stateless Cloudflare Worker that returns a deterministic shared daily color for a neighborhood, computed on read from `(neighborhood_id, day_index)`.

**Architecture:** A single Hono app on Cloudflare Workers. The only persistent state is D1 config (`neighborhoods`, `palettes`, `palette_colors`). Today's color is computed per request via pure `lib/*` functions — no cron, no `daily_colors` table. Responses cache until the next computable rotation instant.

**Tech Stack:** TypeScript (strict) · Hono · Cloudflare Workers · D1 · Drizzle ORM (`drizzle-orm/d1`) · Zod + `@hono/zod-validator` · Luxon · Vitest + `@cloudflare/vitest-pool-workers`. Package manager: npm.

**Design doc:** [`docs/superpowers/specs/2026-07-15-neighborhue-backend-design.md`](../specs/2026-07-15-neighborhue-backend-design.md). Base spec: [`docs/specs/initial-spec.md`](../../specs/initial-spec.md).

## Global Constraints

- **TypeScript strict** — `strict: true` in tsconfig; no `any` in shipped code except narrowly-scoped JSON parsing.
- **Statelessness** — the Worker holds no state except D1 config. No `daily_colors`/`neighborhood_colors` table, ever. No cron/scheduler. No in-Worker rate limiting.
- **Determinism** — colors are computed from `(neighborhood_id, day_index)`; never stored, never randomly picked. No secret seed.
- **Color object shape** — every color is `{ hex, rgb:[r,g,b], hsl:[h,s,l], name }`. The `rgb` array is a drop-in for Home Assistant `rgb_color:` and must never be removed.
- **Error shape** — all errors are `{ "error": "<snake_case>", "message": "<human readable>" }`.
- **Validation** — hex matches `^#[0-9A-Fa-f]{6}$`; `rotation_hour` in 0–23; `timezone` validated against IANA (reject unknown zones).
- **Color ordering** — a neighborhood's color list is ordered by `palette_colors.position` (tiebreak `id`). Color source: non-empty `custom_colors` → linked palette → default palette (`is_default`).
- **API version prefix** — everything under `/v1`.
- **Env vars** — `CORS_ORIGIN` (management CORS), `MANAGE_URL_BASE` (default `https://neighborhue.app`), binding `DB` (D1).
- **Commits** — conventional commits, one per completed step group. End commit messages with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/index.ts` | Hono app: `AppEnv` type wiring, CORS, error/notFound handlers, mount routes, `GET /` health |
| `src/types.ts` | Shared `AppEnv` (Bindings + Variables) type |
| `src/lib/hash.ts` | `strHash` (FNV-1a) + `mulberry32` PRNG |
| `src/lib/pick.ts` | `pickColorIndex(id, dayIndex, n)` — per-cycle Fisher-Yates |
| `src/lib/color.ts` | `isValidHex`, `hexToRgb`, `rgbToHsl`, `buildColor` |
| `src/lib/rotation.ts` | `rotation(tz, hour, now)` — Luxon day/rotation math |
| `src/lib/ids.ts` | `newNeighborhoodId`, `newAdminSecret` |
| `src/db/schema.ts` | Drizzle tables `neighborhoods`, `palettes`, `palette_colors` |
| `src/db/client.ts` | `getDb(d1)` → `drizzle(d1, { schema })`; `DB` type |
| `src/db/queries.ts` | Typed read/write helpers over the three tables |
| `src/colors/resolve.ts` | Pure `resolveColorList` + `parseCustomColors` |
| `src/middleware/auth.ts` | `constantTimeEqual` + `requireAdminSecret` bearer guard |
| `src/validators.ts` | Zod `createSchema`/`patchSchema` + `zJson` helper |
| `src/routes/neighborhoods.ts` | public read + management CRUD |
| `src/routes/palettes.ts` | `GET /v1/palettes` |
| `seed/palettes.ts` | `PALETTES` data + `seedPalettes(db)` |
| `seed/build-sql.ts` | Emits `seed/seed.sql` from `PALETTES` |
| `test/*.test.ts` | Vitest suites (pure libs + api) |
| `test/apply-migrations.ts` | Test setup: applies D1 migrations |
| `test/env.d.ts` | `cloudflare:test` `ProvidedEnv` typing |
| `migrations/` | drizzle-kit output |
| `drizzle.config.ts`, `wrangler.toml`, `vitest.config.ts`, `tsconfig.json`, `package.json`, `README.md` | tooling/config |

---

## Task 1: Scaffold, tooling, and Hono skeleton

**Files:**
- Create: `package.json`, `tsconfig.json`, `wrangler.toml`, `vitest.config.ts`, `.gitignore`
- Create: `src/types.ts`, `src/index.ts`
- Create: `test/env.d.ts`, `test/smoke.test.ts`

**Interfaces:**
- Produces: `AppEnv` type `{ Bindings: { DB: D1Database; CORS_ORIGIN: string; MANAGE_URL_BASE: string }; Variables: { neighborhood: import('./db/queries').NeighborhoodRow } }` (the `neighborhood` var is populated by Task 13's middleware; declared now). Default export in `src/index.ts` is the Hono app.

- [ ] **Step 1: Initialize package and install deps**

Run:
```bash
npm init -y
npm pkg set type=module
npm i hono drizzle-orm @hono/zod-validator zod luxon
npm i -D typescript wrangler vitest @cloudflare/vitest-pool-workers @cloudflare/workers-types drizzle-kit tsx @types/luxon @types/node
```
Expected: dependencies added; `node_modules/` created.

- [ ] **Step 2: Write `package.json` scripts**

Set the `scripts` block (via editing `package.json`):
```json
{
  "scripts": {
    "dev": "wrangler dev",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate:local": "wrangler d1 migrations apply neighborhue --local",
    "db:migrate:remote": "wrangler d1 migrations apply neighborhue --remote",
    "seed:build": "tsx seed/build-sql.ts",
    "seed:local": "npm run seed:build && wrangler d1 execute neighborhue --local --file=seed/seed.sql",
    "seed:remote": "npm run seed:build && wrangler d1 execute neighborhue --remote --file=seed/seed.sql",
    "seed": "npm run seed:remote",
    "deploy": "wrangler deploy"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "types": ["@cloudflare/workers-types", "@cloudflare/vitest-pool-workers"]
  },
  "include": ["src", "seed", "test", "*.ts"]
}
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules/
dist/
.wrangler/
.dev.vars
seed/seed.sql
*.log
```

- [ ] **Step 5: Write `wrangler.toml` (no D1 binding yet — added in Task 7)**

```toml
name = "neighborhue-api"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[vars]
CORS_ORIGIN = "https://neighborhue.app"
MANAGE_URL_BASE = "https://neighborhue.app"
```

- [ ] **Step 6: Write `src/types.ts`**

```ts
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
```

- [ ] **Step 7: Write `src/index.ts` (skeleton — routes mounted in later tasks)**

```ts
import { Hono } from 'hono'
import type { AppEnv } from './types'

const app = new Hono<AppEnv>()

app.get('/', (c) => c.json({ name: 'neighborhue', version: 'v1' }))

app.notFound((c) => c.json({ error: 'not_found', message: 'Not found' }, 404))

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'internal_error', message: 'Something went wrong' }, 500)
})

export default app
```

Note: `src/types.ts` imports from `src/db/queries.ts`, which does not exist until Task 10. To keep Task 1 type-checking, temporarily add `export type NeighborhoodRow = Record<string, unknown>` at the bottom of `src/types.ts` and delete it in Task 10 once `queries.ts` exists. (Simpler alternative: define `NeighborhoodRow` inline in Task 1 and re-point the import in Task 10.)

- [ ] **Step 8: Write minimal `vitest.config.ts` (D1 test infra added in Task 7)**

```ts
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
      },
    },
  },
})
```

> **Verify (drift-prone):** confirm the installed `@cloudflare/vitest-pool-workers` exposes `defineWorkersConfig` from `/config`. Run `npm ls @cloudflare/vitest-pool-workers` and skim its README. If the version uses the newer `cloudflareTest` plugin form instead, adapt this file and Task 7's config accordingly.

- [ ] **Step 9: Write `test/env.d.ts`**

```ts
import type { D1Migration } from '@cloudflare/workers-types'

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database
    CORS_ORIGIN: string
    MANAGE_URL_BASE: string
    TEST_MIGRATIONS: D1Migration[]
  }
}
```

- [ ] **Step 10: Write `test/smoke.test.ts`**

```ts
import { SELF } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'

describe('app skeleton', () => {
  it('serves the health root', async () => {
    const res = await SELF.fetch('https://example.com/')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ name: 'neighborhue', version: 'v1' })
  })

  it('returns the error shape for unknown routes', async () => {
    const res = await SELF.fetch('https://example.com/nope')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found', message: 'Not found' })
  })
})
```

- [ ] **Step 11: Run tests to verify they pass**

Run: `npm test`
Expected: 2 passing tests in `test/smoke.test.ts`.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold Hono Worker project with vitest workers pool"
```

---

## Task 2: `lib/hash.ts` — deterministic hash + PRNG

**Files:**
- Create: `src/lib/hash.ts`
- Test: `test/hash.test.ts`

**Interfaces:**
- Produces: `strHash(s: string): number` (uint32), `mulberry32(seed: number): () => number` (each call returns a float in `[0, 1)`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { strHash, mulberry32 } from '../src/lib/hash'

describe('strHash', () => {
  it('is deterministic', () => {
    expect(strHash('abc:0')).toBe(strHash('abc:0'))
  })
  it('returns an unsigned 32-bit integer', () => {
    const h = strHash('anything')
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThanOrEqual(0xffffffff)
    expect(Number.isInteger(h)).toBe(true)
  })
  it('differs for different inputs', () => {
    expect(strHash('a')).not.toBe(strHash('b'))
  })
})

describe('mulberry32', () => {
  it('produces a deterministic sequence for a seed', () => {
    const a = mulberry32(123)
    const b = mulberry32(123)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('produces floats in [0, 1)', () => {
    const r = mulberry32(999)
    for (let i = 0; i < 100; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/hash.test.ts`
Expected: FAIL — cannot find module `../src/lib/hash`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/hash.ts

// FNV-1a 32-bit — small, stable, runtime-independent.
export function strHash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// Deterministic PRNG; returns a function producing floats in [0, 1).
export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/hash.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/hash.ts test/hash.test.ts
git commit -m "feat: add FNV-1a hash and mulberry32 PRNG"
```

---

## Task 3: `lib/pick.ts` — deterministic color selection

**Files:**
- Create: `src/lib/pick.ts`
- Test: `test/pick.test.ts`

**Interfaces:**
- Consumes: `strHash`, `mulberry32` from `src/lib/hash`.
- Produces: `pickColorIndex(neighborhoodId: string, dayIndex: number, n: number): number` — returns an index in `[0, n)`. Throws on `n <= 0`. Within any cycle-aligned window `[c*n, c*n + n)` every index appears exactly once.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { pickColorIndex } from '../src/lib/pick'

describe('pickColorIndex', () => {
  it('is deterministic for the same (id, dayIndex, n)', () => {
    expect(pickColorIndex('nb1', 42, 7)).toBe(pickColorIndex('nb1', 42, 7))
  })

  it('returns 0 when there is a single color', () => {
    expect(pickColorIndex('nb1', 12345, 1)).toBe(0)
  })

  it('throws when the color list is empty', () => {
    expect(() => pickColorIndex('nb1', 0, 0)).toThrow('empty color list')
  })

  it('always returns an index within range', () => {
    for (let d = 0; d < 200; d++) {
      const idx = pickColorIndex('nb1', d, 7)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(7)
    }
  })

  it('yields each index exactly once within a cycle-aligned window of n days', () => {
    const n = 7
    for (let cycle = 0; cycle < 5; cycle++) {
      const start = cycle * n
      const seen = new Set<number>()
      for (let d = start; d < start + n; d++) seen.add(pickColorIndex('nb1', d, n))
      expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6])
    }
  })

  it('uses different orders across neighborhoods (variation on a fixed day)', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const values = new Set(ids.map((id) => pickColorIndex(id, 100, 7)))
    expect(values.size).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/pick.test.ts`
Expected: FAIL — cannot find module `../src/lib/pick`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/pick.ts
import { strHash, mulberry32 } from './hash'

// Deterministic, evenly-distributed selection from an ordered color list.
// Each cycle of n days is a fresh seeded Fisher-Yates permutation of [0..n),
// so within a cycle every color appears exactly once.
//
// TODO(v1): the only possible adjacent repeat is at a cycle boundary (last of
// one cycle == first of the next). Acceptable for v1; to eliminate, reshuffle
// the next cycle until order[0] !== previousCycleLast.
export function pickColorIndex(neighborhoodId: string, dayIndex: number, n: number): number {
  if (n <= 0) throw new Error('empty color list')
  if (n === 1) return 0
  const cycle = Math.floor(dayIndex / n)
  const pos = ((dayIndex % n) + n) % n
  const rnd = mulberry32(strHash(`${neighborhoodId}:${cycle}`))
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order[pos]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/pick.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pick.ts test/pick.test.ts
git commit -m "feat: add deterministic per-cycle color selection"
```

---

## Task 4: `lib/color.ts` — hex/rgb/hsl conversion

**Files:**
- Create: `src/lib/color.ts`
- Test: `test/color.test.ts`

**Interfaces:**
- Produces:
  - `HEX_RE = /^#[0-9A-Fa-f]{6}$/`
  - `isValidHex(hex: string): boolean`
  - `hexToRgb(hex: string): [number, number, number]` (throws on invalid hex)
  - `rgbToHsl(r: number, g: number, b: number): [number, number, number]` (h 0–360, s/l 0–100, integers)
  - `Color = { hex: string; rgb: [number, number, number]; hsl: [number, number, number]; name: string | null }`
  - `buildColor(hex: string, name: string | null): Color`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { isValidHex, hexToRgb, rgbToHsl, buildColor } from '../src/lib/color'

describe('isValidHex', () => {
  it('accepts #RRGGBB', () => {
    expect(isValidHex('#FF0000')).toBe(true)
    expect(isValidHex('#00ff00')).toBe(true)
  })
  it('rejects malformed values', () => {
    expect(isValidHex('#FFF')).toBe(false)
    expect(isValidHex('FF0000')).toBe(false)
    expect(isValidHex('#GG0000')).toBe(false)
  })
})

describe('hexToRgb', () => {
  it('converts known hex values', () => {
    expect(hexToRgb('#FF0000')).toEqual([255, 0, 0])
    expect(hexToRgb('#00FF00')).toEqual([0, 255, 0])
    expect(hexToRgb('#0000FF')).toEqual([0, 0, 255])
    expect(hexToRgb('#FFFFFF')).toEqual([255, 255, 255])
  })
  it('throws on invalid hex', () => {
    expect(() => hexToRgb('nope')).toThrow('invalid hex')
  })
})

describe('rgbToHsl', () => {
  it('converts known values', () => {
    expect(rgbToHsl(255, 0, 0)).toEqual([0, 100, 50])
    expect(rgbToHsl(0, 255, 0)).toEqual([120, 100, 50])
    expect(rgbToHsl(0, 0, 255)).toEqual([240, 100, 50])
    expect(rgbToHsl(255, 255, 255)).toEqual([0, 0, 100])
    expect(rgbToHsl(0, 0, 0)).toEqual([0, 0, 0])
  })
})

describe('buildColor', () => {
  it('assembles hex/rgb/hsl/name', () => {
    expect(buildColor('#FF0000', 'Red')).toEqual({
      hex: '#FF0000',
      rgb: [255, 0, 0],
      hsl: [0, 100, 50],
      name: 'Red',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/color.test.ts`
Expected: FAIL — cannot find module `../src/lib/color`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/color.ts
export const HEX_RE = /^#[0-9A-Fa-f]{6}$/

export function isValidHex(hex: string): boolean {
  return HEX_RE.test(hex)
}

export function hexToRgb(hex: string): [number, number, number] {
  if (!isValidHex(hex)) throw new Error(`invalid hex: ${hex}`)
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case rn:
        h = ((gn - bn) / d) % 6
        break
      case gn:
        h = (bn - rn) / d + 2
        break
      default:
        h = (rn - gn) / d + 4
        break
    }
    h *= 60
    if (h < 0) h += 360
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]
}

export interface Color {
  hex: string
  rgb: [number, number, number]
  hsl: [number, number, number]
  name: string | null
}

export function buildColor(hex: string, name: string | null): Color {
  const [r, g, b] = hexToRgb(hex)
  return { hex, rgb: [r, g, b], hsl: rgbToHsl(r, g, b), name }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/color.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/color.ts test/color.test.ts
git commit -m "feat: add hex/rgb/hsl color conversion"
```

---

## Task 5: `lib/rotation.ts` — DST-safe day/rotation math

**Files:**
- Create: `src/lib/rotation.ts`
- Test: `test/rotation.test.ts`

**Interfaces:**
- Produces:
  - `RotationInfo = { dayIndex: number; rotatedAt: string; nextRotationAt: string; secondsUntilRotation: number }`
  - `rotation(timezone: string, rotationHour: number, now?: DateTime): RotationInfo`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { DateTime } from 'luxon'
import { rotation } from '../src/lib/rotation'

const CHI = 'America/Chicago'

describe('rotation', () => {
  it('before rotationHour local, the color-day is yesterday', () => {
    // 06:00 local in Chicago on 2026-07-15 (CDT = UTC-5) => 11:00 UTC
    const now = DateTime.fromISO('2026-07-15T11:00:00.000Z', { zone: 'utc' })
    const info = rotation(CHI, 7, now)
    // color-day started 2026-07-14T07:00 local => 12:00 UTC
    expect(info.rotatedAt).toBe('2026-07-14T12:00:00.000Z')
    expect(info.nextRotationAt).toBe('2026-07-15T12:00:00.000Z')
  })

  it('at/after rotationHour local, the color-day is today', () => {
    // 08:00 local in Chicago on 2026-07-15 => 13:00 UTC
    const now = DateTime.fromISO('2026-07-15T13:00:00.000Z', { zone: 'utc' })
    const info = rotation(CHI, 7, now)
    expect(info.rotatedAt).toBe('2026-07-15T12:00:00.000Z')
    expect(info.nextRotationAt).toBe('2026-07-16T12:00:00.000Z')
  })

  it('dayIndex matches the spec sample for 2026-07-15', () => {
    const now = DateTime.fromISO('2026-07-15T13:00:00.000Z', { zone: 'utc' })
    expect(rotation(CHI, 7, now).dayIndex).toBe(9692)
  })

  it('dayIndex increments by exactly 1 the next color-day', () => {
    const d1 = rotation(CHI, 7, DateTime.fromISO('2026-07-15T13:00:00.000Z', { zone: 'utc' }))
    const d2 = rotation(CHI, 7, DateTime.fromISO('2026-07-16T13:00:00.000Z', { zone: 'utc' }))
    expect(d2.dayIndex - d1.dayIndex).toBe(1)
  })

  it('keeps the same wall-clock hour across spring-forward (gap is 23h)', () => {
    // US spring-forward 2026-03-08. Evaluate just after the 07:00 rotation on the 8th.
    const now = DateTime.fromISO('2026-03-08T14:00:00.000Z', { zone: 'utc' })
    const info = rotation(CHI, 7, now)
    const start = DateTime.fromISO(info.rotatedAt)
    const next = DateTime.fromISO(info.nextRotationAt)
    // Both are 07:00 local; the real gap is 23 hours across spring-forward.
    expect(next.diff(start, 'hours').hours).toBeCloseTo(23, 5)
    expect(start.setZone(CHI).hour).toBe(7)
    expect(next.setZone(CHI).hour).toBe(7)
  })

  it('keeps the same wall-clock hour across fall-back (gap is 25h)', () => {
    // US fall-back 2026-11-01. Evaluate just after the 07:00 rotation on the 1st.
    const now = DateTime.fromISO('2026-11-01T14:00:00.000Z', { zone: 'utc' })
    const info = rotation(CHI, 7, now)
    const start = DateTime.fromISO(info.rotatedAt)
    const next = DateTime.fromISO(info.nextRotationAt)
    expect(next.diff(start, 'hours').hours).toBeCloseTo(25, 5)
    expect(next.setZone(CHI).hour).toBe(7)
  })

  it('secondsUntilRotation is positive and matches next_rotation_at - now', () => {
    const now = DateTime.fromISO('2026-07-15T13:00:00.000Z', { zone: 'utc' })
    const info = rotation(CHI, 7, now)
    const expected = Math.round(DateTime.fromISO(info.nextRotationAt).diff(now, 'seconds').seconds)
    expect(info.secondsUntilRotation).toBe(expected)
    expect(info.secondsUntilRotation).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/rotation.test.ts`
Expected: FAIL — cannot find module `../src/lib/rotation`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/rotation.ts
import { DateTime } from 'luxon'

const EPOCH = { year: 2000, month: 1, day: 1 } // fixed reference for day indexing

export interface RotationInfo {
  dayIndex: number
  rotatedAt: string
  nextRotationAt: string
  secondsUntilRotation: number
}

export function rotation(
  timezone: string,
  rotationHour: number,
  now: DateTime = DateTime.utc(),
): RotationInfo {
  const local = now.setZone(timezone)

  // The color-day starts at rotationHour local time.
  const rotationToday = local.set({ hour: rotationHour, minute: 0, second: 0, millisecond: 0 })
  const currentStart = local < rotationToday ? rotationToday.minus({ days: 1 }) : rotationToday
  const nextStart = currentStart.plus({ days: 1 }) // Luxon keeps wall-clock hour across DST

  // dayIndex from the CALENDAR date of the color-day start — whole days, DST-immune.
  const epoch = DateTime.fromObject(EPOCH, { zone: timezone })
  const dayIndex = Math.floor(currentStart.startOf('day').diff(epoch.startOf('day'), 'days').days + 0.5)

  return {
    dayIndex,
    rotatedAt: currentStart.toUTC().toISO()!,
    nextRotationAt: nextStart.toUTC().toISO()!,
    secondsUntilRotation: Math.max(0, Math.round(nextStart.diff(now, 'seconds').seconds)),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/rotation.test.ts`
Expected: PASS (7 tests). If a DST assertion is off by an hour, confirm the Workers pool has full ICU timezone data (it should); do not change the algorithm.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rotation.ts test/rotation.test.ts
git commit -m "feat: add DST-safe rotation and day-index math"
```

---

## Task 6: `lib/ids.ts` — id + admin secret generation

**Files:**
- Create: `src/lib/ids.ts`
- Test: `test/ids.test.ts`

**Interfaces:**
- Produces: `newNeighborhoodId(): string` (UUID v4), `newAdminSecret(): string` (`nh_sk_` + base64url of ≥32 random bytes).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { newNeighborhoodId, newAdminSecret } from '../src/lib/ids'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newNeighborhoodId', () => {
  it('returns a UUID v4', () => {
    expect(newNeighborhoodId()).toMatch(UUID_RE)
  })
  it('is unique across calls', () => {
    expect(newNeighborhoodId()).not.toBe(newNeighborhoodId())
  })
})

describe('newAdminSecret', () => {
  it('has the nh_sk_ prefix and base64url body of >= 32 bytes', () => {
    const s = newAdminSecret()
    expect(s.startsWith('nh_sk_')).toBe(true)
    const body = s.slice('nh_sk_'.length)
    expect(body).toMatch(/^[A-Za-z0-9_-]+$/)
    // 32 bytes -> 43 base64url chars (unpadded)
    expect(body.length).toBeGreaterThanOrEqual(43)
  })
  it('is unique across calls', () => {
    expect(newAdminSecret()).not.toBe(newAdminSecret())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/ids.test.ts`
Expected: FAIL — cannot find module `../src/lib/ids`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/ids.ts
export function newNeighborhoodId(): string {
  return crypto.randomUUID()
}

export function newAdminSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return 'nh_sk_' + base64url(bytes)
}

function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/ids.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ids.ts test/ids.test.ts
git commit -m "feat: add neighborhood id and admin secret generation"
```

---

## Task 7: DB schema, client, migrations, and D1 test infrastructure

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`
- Modify: `wrangler.toml` (add D1 binding + `migrations_dir`), `vitest.config.ts` (add D1 migration wiring)
- Create: `test/apply-migrations.ts`, `test/db.test.ts`
- Create: `migrations/` (generated)

**Interfaces:**
- Produces:
  - `neighborhoods`, `palettes`, `paletteColors` Drizzle tables (schema.ts)
  - `getDb(d1: D1Database): DrizzleD1Database<typeof schema>` and `type DB = ReturnType<typeof getDb>` (client.ts)

- [ ] **Step 1: Write `src/db/schema.ts`**

```ts
// src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const neighborhoods = sqliteTable('neighborhoods', {
  id: text('id').primaryKey(), // public UUID v4 — goes in the share URL
  adminSecret: text('admin_secret').notNull().unique(), // unguessable management token
  name: text('name'),
  timezone: text('timezone').notNull().default('UTC'), // IANA
  rotationHour: integer('rotation_hour').notNull().default(7), // 0–23
  paletteId: text('palette_id').references(() => palettes.id), // nullable
  customColors: text('custom_colors'), // nullable JSON: [{ hex, name }]
  createdAt: integer('created_at').notNull(), // unix seconds
})

export const palettes = sqliteTable('palettes', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
})

export const paletteColors = sqliteTable('palette_colors', {
  id: text('id').primaryKey(),
  paletteId: text('palette_id').notNull().references(() => palettes.id, { onDelete: 'cascade' }),
  hex: text('hex').notNull(),
  name: text('name'),
  position: integer('position').notNull().default(0), // stable ordering
})
```

- [ ] **Step 2: Write `src/db/client.ts`**

```ts
// src/db/client.ts
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

export function getDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

export type DB = ReturnType<typeof getDb>
```

- [ ] **Step 3: Write `drizzle.config.ts`**

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
})
```

- [ ] **Step 4: Generate the initial migration**

Run: `npm run db:generate`
Expected: a `migrations/0000_*.sql` file is created with the three `CREATE TABLE` statements. (Generation reads only the schema + dialect; it does not need live credentials.)

- [ ] **Step 5: Add the D1 binding to `wrangler.toml`**

Append to `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "neighborhue"
database_id = "placeholder-set-in-task-17"
migrations_dir = "migrations"
```

- [ ] **Step 6: Wire D1 migrations into the test pool — rewrite `vitest.config.ts`**

```ts
// vitest.config.ts
import path from 'node:path'
import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, 'migrations'))
  return {
    test: {
      setupFiles: ['./test/apply-migrations.ts'],
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.toml' },
          miniflare: {
            // Test-only binding carrying the migrations for the setup file to apply.
            bindings: { TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
  }
})
```

> **Verify (drift-prone):** if `readD1Migrations`/`defineWorkersConfig` are not exported from `@cloudflare/vitest-pool-workers/config` in the installed version, consult its README for the equivalent (some versions use a `cloudflareTest` plugin + `bindings` on the plugin). The intent: read `migrations/` and expose them as the `TEST_MIGRATIONS` binding.

- [ ] **Step 7: Write `test/apply-migrations.ts`**

```ts
// test/apply-migrations.ts
import { applyD1Migrations, env } from 'cloudflare:test'

// Runs before each test file: brings the isolated per-file D1 up to schema.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
```

- [ ] **Step 8: Write `test/db.test.ts`**

```ts
import { env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import { getDb } from '../src/db/client'
import { palettes } from '../src/db/schema'

describe('D1 migrations + drizzle client', () => {
  it('has the palettes table and it starts empty', async () => {
    const db = getDb(env.DB)
    const rows = await db.select().from(palettes).all()
    expect(rows).toEqual([])
  })
})
```

- [ ] **Step 9: Run the full suite to verify migrations apply**

Run: `npm test`
Expected: all prior tests still pass, plus `test/db.test.ts` passes (proves migrations apply in the pool).

- [ ] **Step 10: Commit**

```bash
git add src/db/schema.ts src/db/client.ts drizzle.config.ts wrangler.toml vitest.config.ts test/apply-migrations.ts test/db.test.ts migrations/
git commit -m "feat: add D1 schema, drizzle client, and migration test harness"
```

---

## Task 8: Seed data — `seed/palettes.ts` and SQL generator

**Files:**
- Create: `seed/palettes.ts`, `seed/build-sql.ts`
- Test: `test/seed.test.ts`

**Interfaces:**
- Consumes: `DB` from `src/db/client`; tables from `src/db/schema`.
- Produces:
  - `SeedColor = { hex: string; name: string }`, `SeedPalette = { slug: string; name: string; description: string; isDefault?: boolean; colors: SeedColor[] }`
  - `PALETTES: SeedPalette[]` (7 palettes)
  - `seedPalettes(db: DB): Promise<void>` — idempotent insert (uses `onConflictDoNothing`)

- [ ] **Step 1: Write `seed/palettes.ts` (data + seeder)**

```ts
// seed/palettes.ts
import type { DB } from '../src/db/client'
import { palettes, paletteColors } from '../src/db/schema'

export interface SeedColor {
  hex: string
  name: string
}
export interface SeedPalette {
  slug: string
  name: string
  description: string
  isDefault?: boolean
  colors: SeedColor[]
}

export const PALETTES: SeedPalette[] = [
  {
    slug: 'rainbow',
    name: 'Rainbow Colors',
    description: 'The classic seven-color rainbow.',
    isDefault: true,
    colors: [
      { hex: '#FF0000', name: 'Red' },
      { hex: '#FF8000', name: 'Orange' },
      { hex: '#FFD700', name: 'Yellow' },
      { hex: '#00FF00', name: 'Green' },
      { hex: '#0080FF', name: 'Blue' },
      { hex: '#4B0082', name: 'Indigo' },
      { hex: '#8000FF', name: 'Violet' },
    ],
  },
  {
    slug: 'rainbow-warm-white',
    name: 'Rainbow + Warm White',
    description: 'The rainbow plus a warm white (best on RGBW/CCT bulbs).',
    colors: [
      { hex: '#FF0000', name: 'Red' },
      { hex: '#FF8000', name: 'Orange' },
      { hex: '#FFD700', name: 'Yellow' },
      { hex: '#00FF00', name: 'Green' },
      { hex: '#0080FF', name: 'Blue' },
      { hex: '#4B0082', name: 'Indigo' },
      { hex: '#8000FF', name: 'Violet' },
      { hex: '#FDF4DC', name: 'Warm White' },
    ],
  },
  {
    slug: 'mixed',
    name: 'Mixed (Surprise)',
    description: 'A broad, high-saturation spread across the wheel — the "surprise me" set.',
    colors: [
      { hex: '#FF0000', name: 'Red' },
      { hex: '#FF4D00', name: 'Vermilion' },
      { hex: '#FF9900', name: 'Orange' },
      { hex: '#FFE600', name: 'Gold' },
      { hex: '#CCFF00', name: 'Chartreuse' },
      { hex: '#80FF00', name: 'Lime' },
      { hex: '#33FF00', name: 'Bright Green' },
      { hex: '#00FF1A', name: 'Green' },
      { hex: '#00FF66', name: 'Spring Green' },
      { hex: '#00FFB3', name: 'Aquamarine' },
      { hex: '#00FFFF', name: 'Cyan' },
      { hex: '#00B3FF', name: 'Sky Blue' },
      { hex: '#0066FF', name: 'Azure' },
      { hex: '#001AFF', name: 'Blue' },
      { hex: '#3300FF', name: 'Indigo' },
      { hex: '#8000FF', name: 'Violet' },
      { hex: '#CC00FF', name: 'Purple' },
      { hex: '#FF00E6', name: 'Magenta' },
      { hex: '#FF0099', name: 'Rose' },
      { hex: '#FF004D', name: 'Crimson' },
    ],
  },
  {
    slug: 'vivid',
    name: 'Vivid / Neon',
    description: 'Max-saturation brights.',
    colors: [
      { hex: '#FF073A', name: 'Electric Red' },
      { hex: '#FF6700', name: 'Electric Orange' },
      { hex: '#FFF700', name: 'Electric Yellow' },
      { hex: '#39FF14', name: 'Electric Green' },
      { hex: '#00FFFF', name: 'Electric Cyan' },
      { hex: '#3D5AFF', name: 'Electric Blue' },
      { hex: '#BC13FE', name: 'Electric Purple' },
      { hex: '#FF10F0', name: 'Electric Magenta' },
      { hex: '#FF3CAC', name: 'Electric Pink' },
    ],
  },
  {
    slug: 'warm',
    name: 'Warm',
    description: 'Reds, oranges, ambers, and warm pinks.',
    colors: [
      { hex: '#FF0000', name: 'Red' },
      { hex: '#FF3300', name: 'Scarlet' },
      { hex: '#FF6600', name: 'Orange' },
      { hex: '#FF9900', name: 'Amber' },
      { hex: '#FFCC00', name: 'Gold' },
      { hex: '#FF0066', name: 'Raspberry' },
      { hex: '#FF00AA', name: 'Warm Magenta' },
      { hex: '#FF1493', name: 'Deep Pink' },
    ],
  },
  {
    slug: 'cool',
    name: 'Cool',
    description: 'Blues, teals, greens, and violets.',
    colors: [
      { hex: '#00FF00', name: 'Green' },
      { hex: '#00FF99', name: 'Spring Green' },
      { hex: '#00FFCC', name: 'Turquoise' },
      { hex: '#00FFFF', name: 'Cyan' },
      { hex: '#0099FF', name: 'Sky Blue' },
      { hex: '#0033FF', name: 'Blue' },
      { hex: '#6600FF', name: 'Indigo' },
      { hex: '#9900FF', name: 'Violet' },
    ],
  },
  {
    slug: 'primary',
    name: 'Primary & Secondary',
    description: 'Pure additive colors — highest reproduction fidelity.',
    colors: [
      { hex: '#FF0000', name: 'Red' },
      { hex: '#00FF00', name: 'Green' },
      { hex: '#0000FF', name: 'Blue' },
      { hex: '#FFFF00', name: 'Yellow' },
      { hex: '#00FFFF', name: 'Cyan' },
      { hex: '#FF00FF', name: 'Magenta' },
    ],
  },
]

// Idempotent: safe to run repeatedly. Deterministic ids make re-seeds no-ops.
export async function seedPalettes(db: DB): Promise<void> {
  for (const p of PALETTES) {
    const paletteId = `pal_${p.slug}`
    await db
      .insert(palettes)
      .values({
        id: paletteId,
        slug: p.slug,
        name: p.name,
        description: p.description,
        isDefault: p.isDefault ?? false,
        isActive: true,
      })
      .onConflictDoNothing()
    for (let i = 0; i < p.colors.length; i++) {
      await db
        .insert(paletteColors)
        .values({
          id: `${p.slug}-${i}`,
          paletteId,
          hex: p.colors[i].hex,
          name: p.colors[i].name,
          position: i,
        })
        .onConflictDoNothing()
    }
  }
}
```

- [ ] **Step 2: Write `seed/build-sql.ts` (production seeding via `wrangler d1 execute`)**

```ts
// seed/build-sql.ts
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PALETTES } from './palettes'

const q = (s: string) => `'${s.replace(/'/g, "''")}'`

const lines: string[] = ['-- Generated by seed/build-sql.ts. Do not edit by hand.']
for (const p of PALETTES) {
  const paletteId = `pal_${p.slug}`
  lines.push(
    `INSERT OR IGNORE INTO palettes (id, slug, name, description, is_default, is_active) ` +
      `VALUES (${q(paletteId)}, ${q(p.slug)}, ${q(p.name)}, ${q(p.description)}, ${p.isDefault ? 1 : 0}, 1);`,
  )
  p.colors.forEach((col, i) => {
    lines.push(
      `INSERT OR IGNORE INTO palette_colors (id, palette_id, hex, name, position) ` +
        `VALUES (${q(`${p.slug}-${i}`)}, ${q(paletteId)}, ${q(col.hex)}, ${q(col.name)}, ${i});`,
    )
  })
}

const outPath = join(dirname(fileURLToPath(import.meta.url)), 'seed.sql')
writeFileSync(outPath, lines.join('\n') + '\n')
console.log(`Wrote ${outPath} (${PALETTES.length} palettes)`)
```

- [ ] **Step 3: Write `test/seed.test.ts`**

```ts
import { env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import { getDb } from '../src/db/client'
import { palettes, paletteColors } from '../src/db/schema'
import { eq } from 'drizzle-orm'
import { seedPalettes, PALETTES } from '../seed/palettes'

describe('seedPalettes', () => {
  it('seeds all seven palettes with rainbow as default', async () => {
    const db = getDb(env.DB)
    await seedPalettes(db)
    const rows = await db.select().from(palettes).all()
    expect(rows.length).toBe(7)
    const def = rows.filter((p) => p.isDefault)
    expect(def.map((p) => p.slug)).toEqual(['rainbow'])
  })

  it('seeds the correct color counts per palette', async () => {
    const db = getDb(env.DB)
    await seedPalettes(db)
    for (const p of PALETTES) {
      const colors = await db.select().from(paletteColors).where(eq(paletteColors.paletteId, `pal_${p.slug}`)).all()
      expect(colors.length).toBe(p.colors.length)
    }
  })

  it('is idempotent (re-seeding does not duplicate)', async () => {
    const db = getDb(env.DB)
    await seedPalettes(db)
    await seedPalettes(db)
    const rows = await db.select().from(palettes).all()
    expect(rows.length).toBe(7)
  })
})
```

- [ ] **Step 4: Run tests + the SQL generator**

Run: `npm test -- test/seed.test.ts && npm run seed:build`
Expected: 3 passing tests; `seed/seed.sql` written (gitignored). Confirm generator prints "Wrote …/seed.sql (7 palettes)".

- [ ] **Step 5: Commit**

```bash
git add seed/palettes.ts seed/build-sql.ts test/seed.test.ts
git commit -m "feat: add curated palette seed data and SQL generator"
```

---

## Task 9: `colors/resolve.ts` — pure color-source resolution

**Files:**
- Create: `src/colors/resolve.ts`
- Test: `test/resolve.test.ts`

**Interfaces:**
- Consumes: `isValidHex` from `src/lib/color`.
- Produces:
  - `ColorEntry = { hex: string; name: string | null }`
  - `resolveColorList(input: { customColors: ColorEntry[] | null; paletteColors: ColorEntry[]; defaultPaletteColors: ColorEntry[] }): ColorEntry[]`
  - `parseCustomColors(json: string | null): ColorEntry[] | null` — returns `null` if absent/empty/malformed.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { resolveColorList, parseCustomColors } from '../src/colors/resolve'

describe('resolveColorList', () => {
  const palette = [{ hex: '#111111', name: 'p' }]
  const def = [{ hex: '#222222', name: 'd' }]

  it('prefers non-empty custom colors', () => {
    const custom = [{ hex: '#FF0000', name: 'c' }]
    expect(resolveColorList({ customColors: custom, paletteColors: palette, defaultPaletteColors: def })).toBe(custom)
  })
  it('falls back to the linked palette when custom is null', () => {
    expect(resolveColorList({ customColors: null, paletteColors: palette, defaultPaletteColors: def })).toBe(palette)
  })
  it('falls back to the default palette when custom and palette are empty', () => {
    expect(resolveColorList({ customColors: null, paletteColors: [], defaultPaletteColors: def })).toBe(def)
  })
})

describe('parseCustomColors', () => {
  it('returns null for null/empty/whitespace', () => {
    expect(parseCustomColors(null)).toBeNull()
    expect(parseCustomColors('[]')).toBeNull()
  })
  it('parses valid entries and defaults name to null', () => {
    expect(parseCustomColors('[{"hex":"#FF0000","name":"Red"},{"hex":"#00FF00"}]')).toEqual([
      { hex: '#FF0000', name: 'Red' },
      { hex: '#00FF00', name: null },
    ])
  })
  it('drops invalid hex entries and returns null if none remain', () => {
    expect(parseCustomColors('[{"hex":"nope"}]')).toBeNull()
  })
  it('returns null for malformed json', () => {
    expect(parseCustomColors('{not json')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/resolve.test.ts`
Expected: FAIL — cannot find module `../src/colors/resolve`.

- [ ] **Step 3: Write the implementation**

```ts
// src/colors/resolve.ts
import { isValidHex } from '../lib/color'

export interface ColorEntry {
  hex: string
  name: string | null
}

export interface ResolveInput {
  customColors: ColorEntry[] | null
  paletteColors: ColorEntry[] // ordered
  defaultPaletteColors: ColorEntry[] // ordered
}

// custom_colors (non-empty) wins → linked palette → default palette.
export function resolveColorList(input: ResolveInput): ColorEntry[] {
  if (input.customColors && input.customColors.length > 0) return input.customColors
  if (input.paletteColors.length > 0) return input.paletteColors
  return input.defaultPaletteColors
}

// Defensive read-side parse of the stored custom_colors JSON.
export function parseCustomColors(json: string | null): ColorEntry[] | null {
  if (!json) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  const out: ColorEntry[] = []
  for (const item of parsed) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as { hex?: unknown }).hex === 'string' &&
      isValidHex((item as { hex: string }).hex)
    ) {
      const name = (item as { name?: unknown }).name
      out.push({ hex: (item as { hex: string }).hex, name: typeof name === 'string' ? name : null })
    }
  }
  return out.length > 0 ? out : null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/resolve.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/colors/resolve.ts test/resolve.test.ts
git commit -m "feat: add pure color-source resolution"
```

---

## Task 10: `db/queries.ts` — typed data-access helpers

**Files:**
- Create: `src/db/queries.ts`
- Modify: `src/types.ts` (remove the temporary `NeighborhoodRow` placeholder from Task 1; it now imports the real type)
- Test: `test/queries.test.ts`

**Interfaces:**
- Consumes: `DB` from `src/db/client`; tables from `src/db/schema`; `eq`, `asc` from `drizzle-orm`.
- Produces:
  - `NeighborhoodRow = typeof neighborhoods.$inferSelect`, `NeighborhoodInsert = typeof neighborhoods.$inferInsert`
  - `PaletteRow = typeof palettes.$inferSelect`, `PaletteColorRow = typeof paletteColors.$inferSelect`
  - `getNeighborhood(db, id): Promise<NeighborhoodRow | undefined>`
  - `insertNeighborhood(db, row: NeighborhoodInsert): Promise<void>`
  - `updateNeighborhood(db, id, patch: Partial<NeighborhoodInsert>): Promise<void>`
  - `deleteNeighborhood(db, id): Promise<void>`
  - `getPaletteBySlug(db, slug): Promise<PaletteRow | undefined>`
  - `getPaletteById(db, id): Promise<PaletteRow | undefined>`
  - `getDefaultPalette(db): Promise<PaletteRow | undefined>`
  - `getPaletteColors(db, paletteId): Promise<PaletteColorRow[]>` (ordered by position, then id)
  - `listActivePalettes(db): Promise<PaletteRow[]>` (ordered by slug)

- [ ] **Step 1: Write the failing test**

```ts
import { env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import { getDb } from '../src/db/client'
import { seedPalettes } from '../seed/palettes'
import {
  insertNeighborhood,
  getNeighborhood,
  updateNeighborhood,
  deleteNeighborhood,
  getPaletteBySlug,
  getDefaultPalette,
  getPaletteColors,
  listActivePalettes,
} from '../src/db/queries'

describe('neighborhood queries', () => {
  it('inserts, reads, updates, and deletes a neighborhood', async () => {
    const db = getDb(env.DB)
    await insertNeighborhood(db, {
      id: 'nb-1',
      adminSecret: 'nh_sk_test',
      name: 'Test',
      timezone: 'UTC',
      rotationHour: 7,
      paletteId: null,
      customColors: null,
      createdAt: 1_700_000_000,
    })
    expect((await getNeighborhood(db, 'nb-1'))?.name).toBe('Test')

    await updateNeighborhood(db, 'nb-1', { rotationHour: 9 })
    expect((await getNeighborhood(db, 'nb-1'))?.rotationHour).toBe(9)

    await deleteNeighborhood(db, 'nb-1')
    expect(await getNeighborhood(db, 'nb-1')).toBeUndefined()
  })
})

describe('palette queries', () => {
  it('reads palettes by slug/default and ordered colors', async () => {
    const db = getDb(env.DB)
    await seedPalettes(db)

    expect((await getPaletteBySlug(db, 'rainbow'))?.name).toBe('Rainbow Colors')
    expect((await getDefaultPalette(db))?.slug).toBe('rainbow')

    const colors = await getPaletteColors(db, 'pal_rainbow')
    expect(colors.map((c) => c.position)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(colors[0].hex).toBe('#FF0000')

    const active = await listActivePalettes(db)
    expect(active.length).toBe(7)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/queries.test.ts`
Expected: FAIL — cannot find module `../src/db/queries`.

- [ ] **Step 3: Write the implementation**

```ts
// src/db/queries.ts
import { asc, eq } from 'drizzle-orm'
import type { DB } from './client'
import { neighborhoods, palettes, paletteColors } from './schema'

export type NeighborhoodRow = typeof neighborhoods.$inferSelect
export type NeighborhoodInsert = typeof neighborhoods.$inferInsert
export type PaletteRow = typeof palettes.$inferSelect
export type PaletteColorRow = typeof paletteColors.$inferSelect

export async function getNeighborhood(db: DB, id: string): Promise<NeighborhoodRow | undefined> {
  return db.select().from(neighborhoods).where(eq(neighborhoods.id, id)).get()
}

export async function insertNeighborhood(db: DB, row: NeighborhoodInsert): Promise<void> {
  await db.insert(neighborhoods).values(row)
}

export async function updateNeighborhood(db: DB, id: string, patch: Partial<NeighborhoodInsert>): Promise<void> {
  await db.update(neighborhoods).set(patch).where(eq(neighborhoods.id, id))
}

export async function deleteNeighborhood(db: DB, id: string): Promise<void> {
  await db.delete(neighborhoods).where(eq(neighborhoods.id, id))
}

export async function getPaletteBySlug(db: DB, slug: string): Promise<PaletteRow | undefined> {
  return db.select().from(palettes).where(eq(palettes.slug, slug)).get()
}

export async function getPaletteById(db: DB, id: string): Promise<PaletteRow | undefined> {
  return db.select().from(palettes).where(eq(palettes.id, id)).get()
}

export async function getDefaultPalette(db: DB): Promise<PaletteRow | undefined> {
  return db.select().from(palettes).where(eq(palettes.isDefault, true)).get()
}

export async function getPaletteColors(db: DB, paletteId: string): Promise<PaletteColorRow[]> {
  return db
    .select()
    .from(paletteColors)
    .where(eq(paletteColors.paletteId, paletteId))
    .orderBy(asc(paletteColors.position), asc(paletteColors.id))
    .all()
}

export async function listActivePalettes(db: DB): Promise<PaletteRow[]> {
  return db.select().from(palettes).where(eq(palettes.isActive, true)).orderBy(asc(palettes.slug)).all()
}
```

- [ ] **Step 4: Fix the `src/types.ts` placeholder**

If Task 1 added a temporary `export type NeighborhoodRow = Record<string, unknown>` to `src/types.ts`, delete that line now. Confirm `src/types.ts` imports the real type:
```ts
import type { NeighborhoodRow } from './db/queries'
```

- [ ] **Step 5: Run tests + typecheck to verify they pass**

Run: `npm test -- test/queries.test.ts && npm run typecheck`
Expected: PASS; typecheck clean (no leftover placeholder type).

- [ ] **Step 6: Commit**

```bash
git add src/db/queries.ts src/types.ts test/queries.test.ts
git commit -m "feat: add typed data-access query helpers"
```

---

## Task 11: Public read route — `GET /v1/neighborhoods/:id`

**Files:**
- Create: `src/routes/neighborhoods.ts`
- Modify: `src/index.ts` (mount the route)
- Test: `test/api.read.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–10 plus `rotation`, `pickColorIndex`, `buildColor`.
- Produces: `neighborhoodsRoute` (a `Hono<AppEnv>` instance) exported from `src/routes/neighborhoods.ts`. Public read + `?format=hex|rgb` + `ETag`/`If-None-Match`/`Cache-Control`. Management handlers are added in Tasks 13–14; this task creates the file and the public GET only.

- [ ] **Step 1: Write the failing test**

```ts
import { env } from 'cloudflare:test'
import { describe, it, beforeAll, expect } from 'vitest'
import { getDb } from '../src/db/client'
import { insertNeighborhood } from '../src/db/queries'
import { seedPalettes } from '../seed/palettes'

const ID = '51fbbdef-62a7-4d19-b1b2-c91e1d721d20'

beforeAll(async () => {
  const db = getDb(env.DB)
  await seedPalettes(db)
  await insertNeighborhood(db, {
    id: ID,
    adminSecret: 'nh_sk_read_test',
    name: 'Sunset Hill',
    timezone: 'America/Chicago',
    rotationHour: 7,
    paletteId: 'pal_rainbow',
    customColors: null,
    createdAt: 1_700_000_000,
  })
})

describe('GET /v1/neighborhoods/:id', () => {
  it('returns the full shape with cache headers', async () => {
    const res = await env.DB && (await import('cloudflare:test')).SELF.fetch(`https://x/v1/neighborhoods/${ID}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.id).toBe(ID)
    expect(body.name).toBe('Sunset Hill')
    expect(body.timezone).toBe('America/Chicago')
    expect(body.palette).toBe('rainbow')
    expect(typeof body.day_index).toBe('number')
    const color = body.color as Record<string, unknown>
    expect(typeof color.hex).toBe('string')
    expect(Array.isArray(color.rgb)).toBe(true)
    expect((color.rgb as number[]).length).toBe(3)
    expect((color.hsl as number[]).length).toBe(3)
    expect(res.headers.get('ETag')).toBe(`"${ID}-${body.day_index}"`)
    expect(res.headers.get('Cache-Control')).toMatch(/^public, max-age=\d+$/)
  })

  it('returns 404 for an unknown id', async () => {
    const { SELF } = await import('cloudflare:test')
    const res = await SELF.fetch('https://x/v1/neighborhoods/does-not-exist')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'neighborhood_not_found', message: 'Unknown neighborhood' })
  })

  it('supports ?format=hex and ?format=rgb as text/plain', async () => {
    const { SELF } = await import('cloudflare:test')
    const hex = await SELF.fetch(`https://x/v1/neighborhoods/${ID}?format=hex`)
    expect(hex.headers.get('Content-Type')).toMatch(/text\/plain/)
    expect(await hex.text()).toMatch(/^#[0-9A-Fa-f]{6}$/)

    const rgb = await SELF.fetch(`https://x/v1/neighborhoods/${ID}?format=rgb`)
    expect(await rgb.text()).toMatch(/^\d{1,3},\d{1,3},\d{1,3}$/)
  })

  it('honors If-None-Match with a 304', async () => {
    const { SELF } = await import('cloudflare:test')
    const first = await SELF.fetch(`https://x/v1/neighborhoods/${ID}`)
    const etag = first.headers.get('ETag')!
    const second = await SELF.fetch(`https://x/v1/neighborhoods/${ID}`, { headers: { 'If-None-Match': etag } })
    expect(second.status).toBe(304)
  })
})
```

> Note: the first test's `env.DB &&` guard is just to force the `cloudflare:test` import lazily; simplify to a top-level `import { SELF } from 'cloudflare:test'` if preferred — the behavior asserted is what matters.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/api.read.test.ts`
Expected: FAIL — route not mounted (404 for the valid id, or import error for the route file).

- [ ] **Step 3: Write `src/routes/neighborhoods.ts` (public read only)**

```ts
// src/routes/neighborhoods.ts
import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { getDb } from '../db/client'
import { getNeighborhood, getPaletteById, getPaletteColors, getDefaultPalette } from '../db/queries'
import type { NeighborhoodRow } from '../db/queries'
import { rotation } from '../lib/rotation'
import { pickColorIndex } from '../lib/pick'
import { buildColor, type Color } from '../lib/color'
import { resolveColorList, parseCustomColors, type ColorEntry } from '../colors/resolve'

export const neighborhoodsRoute = new Hono<AppEnv>()

// Resolves the ordered color list and derives today's color for a neighborhood.
async function todaysColor(
  db: ReturnType<typeof getDb>,
  nb: NeighborhoodRow,
): Promise<{ color: Color; dayIndex: number; info: ReturnType<typeof rotation>; paletteSlug: string | null }> {
  const info = rotation(nb.timezone, nb.rotationHour)

  const paletteColors: ColorEntry[] = nb.paletteId
    ? (await getPaletteColors(db, nb.paletteId)).map((c) => ({ hex: c.hex, name: c.name }))
    : []
  const def = await getDefaultPalette(db)
  const defColors: ColorEntry[] = def
    ? (await getPaletteColors(db, def.id)).map((c) => ({ hex: c.hex, name: c.name }))
    : []

  const list = resolveColorList({
    customColors: parseCustomColors(nb.customColors),
    paletteColors,
    defaultPaletteColors: defColors,
  })
  const idx = pickColorIndex(nb.id, info.dayIndex, list.length)
  const chosen = list[idx]

  let paletteSlug: string | null = null
  if (nb.paletteId) {
    const p = await getPaletteById(db, nb.paletteId)
    paletteSlug = p?.slug ?? null
  }

  return { color: buildColor(chosen.hex, chosen.name), dayIndex: info.dayIndex, info, paletteSlug }
}

neighborhoodsRoute.get('/:id', async (c) => {
  const id = c.req.param('id')
  const db = getDb(c.env.DB)
  const nb = await getNeighborhood(db, id)
  if (!nb) return c.json({ error: 'neighborhood_not_found', message: 'Unknown neighborhood' }, 404)

  const { color, dayIndex, info, paletteSlug } = await todaysColor(db, nb)
  const etag = `"${nb.id}-${dayIndex}"`
  const cacheControl = `public, max-age=${info.secondsUntilRotation}`

  if (c.req.header('If-None-Match') === etag) {
    return c.body(null, 304, { ETag: etag, 'Cache-Control': cacheControl })
  }

  const format = c.req.query('format')
  if (format === 'hex') {
    return c.text(color.hex, 200, { ETag: etag, 'Cache-Control': cacheControl })
  }
  if (format === 'rgb') {
    return c.text(color.rgb.join(','), 200, { ETag: etag, 'Cache-Control': cacheControl })
  }

  c.header('ETag', etag)
  c.header('Cache-Control', cacheControl)
  return c.json({
    id: nb.id,
    name: nb.name,
    timezone: nb.timezone,
    rotation_hour: nb.rotationHour,
    color,
    rotated_at: info.rotatedAt,
    next_rotation_at: info.nextRotationAt,
    seconds_until_rotation: info.secondsUntilRotation,
    palette: paletteSlug,
    day_index: dayIndex,
  })
})
```

- [ ] **Step 4: Mount the route in `src/index.ts`**

Add the import and mount (leave the health route + handlers in place):
```ts
import { neighborhoodsRoute } from './routes/neighborhoods'
// ...after `const app = ...` and the `GET /` route:
app.route('/v1/neighborhoods', neighborhoodsRoute)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- test/api.read.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/routes/neighborhoods.ts src/index.ts test/api.read.test.ts
git commit -m "feat: add public neighborhood read endpoint with caching"
```

---

## Task 12: `validators.ts` — Zod schemas + error hook

**Files:**
- Create: `src/validators.ts`
- Test: `test/validators.test.ts`

**Interfaces:**
- Consumes: `HEX_RE` from `src/lib/color`; `IANAZone` from `luxon`; `zValidator` from `@hono/zod-validator`.
- Produces:
  - `createSchema` (Zod): `{ name?, timezone?, rotation_hour?, palette? }`, strict.
  - `patchSchema` (Zod): `{ name?, timezone?, rotation_hour?, palette?, custom_colors? }` with nullable name/palette/custom_colors, strict.
  - `zJson(schema)` — a preconfigured `zValidator('json', schema, hook)` returning the `{ error:'invalid_request', message }` 400 shape on failure.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { createSchema, patchSchema } from '../src/validators'

describe('createSchema', () => {
  it('accepts a valid body', () => {
    expect(createSchema.safeParse({ name: 'A', timezone: 'America/Chicago', rotation_hour: 7, palette: 'rainbow' }).success).toBe(true)
  })
  it('accepts an empty body (all optional)', () => {
    expect(createSchema.safeParse({}).success).toBe(true)
  })
  it('rejects an unknown IANA timezone', () => {
    expect(createSchema.safeParse({ timezone: 'Mars/Olympus' }).success).toBe(false)
  })
  it('rejects rotation_hour out of 0-23', () => {
    expect(createSchema.safeParse({ rotation_hour: 24 }).success).toBe(false)
    expect(createSchema.safeParse({ rotation_hour: -1 }).success).toBe(false)
  })
  it('rejects unknown keys', () => {
    expect(createSchema.safeParse({ nope: 1 }).success).toBe(false)
  })
})

describe('patchSchema', () => {
  it('accepts custom_colors with valid hex', () => {
    expect(patchSchema.safeParse({ custom_colors: [{ hex: '#FF0000', name: 'Red' }] }).success).toBe(true)
  })
  it('accepts null to clear palette/custom_colors', () => {
    expect(patchSchema.safeParse({ palette: null, custom_colors: null }).success).toBe(true)
  })
  it('rejects malformed hex in custom_colors', () => {
    expect(patchSchema.safeParse({ custom_colors: [{ hex: 'red' }] }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/validators.test.ts`
Expected: FAIL — cannot find module `../src/validators`.

- [ ] **Step 3: Write the implementation**

```ts
// src/validators.ts
import { z } from 'zod'
import { IANAZone } from 'luxon'
import { zValidator } from '@hono/zod-validator'
import { HEX_RE } from './lib/color'

const timezone = z.string().refine((tz) => IANAZone.isValidZone(tz), { message: 'invalid timezone' })
const rotationHour = z.number().int().min(0).max(23)
const hex = z.string().regex(HEX_RE, 'invalid hex color')
const customColor = z.object({ hex, name: z.string().max(120).optional() }).strict()

export const createSchema = z
  .object({
    name: z.string().max(120).optional(),
    timezone: timezone.optional(),
    rotation_hour: rotationHour.optional(),
    palette: z.string().max(120).optional(),
  })
  .strict()

export const patchSchema = z
  .object({
    name: z.string().max(120).nullable().optional(),
    timezone: timezone.optional(),
    rotation_hour: rotationHour.optional(),
    palette: z.string().max(120).nullable().optional(),
    custom_colors: z.array(customColor).nullable().optional(),
  })
  .strict()

// Shared JSON validator that emits the project error shape on failure.
export const zJson = <T extends z.ZodTypeAny>(schema: T) =>
  zValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: 'invalid_request', message: result.error.issues.map((i) => i.message).join('; ') },
        400,
      )
    }
  })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/validators.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/validators.ts test/validators.test.ts
git commit -m "feat: add Zod create/patch validators"
```

---

## Task 13: `middleware/auth.ts` — bearer admin-secret guard

**Files:**
- Create: `src/middleware/auth.ts`
- Test: `test/auth.test.ts`

**Interfaces:**
- Consumes: `getDb`, `getNeighborhood`, `AppEnv`.
- Produces:
  - `constantTimeEqual(a: string, b: string): boolean`
  - `requireAdminSecret` — Hono middleware: `401` if bearer missing/blank, `404` if id unknown, `403` if secret mismatch; on success sets `c.set('neighborhood', row)` and calls `next()`.

- [ ] **Step 1: Write the failing test** (uses a throwaway app to exercise the middleware in isolation)

```ts
import { env } from 'cloudflare:test'
import { describe, it, beforeAll, expect } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../src/types'
import { getDb } from '../src/db/client'
import { insertNeighborhood } from '../src/db/queries'
import { requireAdminSecret, constantTimeEqual } from '../src/middleware/auth'

const ID = 'auth-nb'
const SECRET = 'nh_sk_correct_secret_value'

beforeAll(async () => {
  await insertNeighborhood(getDb(env.DB), {
    id: ID,
    adminSecret: SECRET,
    name: null,
    timezone: 'UTC',
    rotationHour: 7,
    paletteId: null,
    customColors: null,
    createdAt: 1_700_000_000,
  })
})

function app() {
  const a = new Hono<AppEnv>()
  a.get('/:id/guarded', requireAdminSecret, (c) => c.json({ ok: true, name: c.get('neighborhood').id }))
  return a
}

describe('constantTimeEqual', () => {
  it('is true only for identical strings', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true)
    expect(constantTimeEqual('abc', 'abd')).toBe(false)
    expect(constantTimeEqual('abc', 'abcd')).toBe(false)
  })
})

describe('requireAdminSecret', () => {
  it('401 when the bearer token is missing', async () => {
    const res = await app().request(`/${ID}/guarded`, {}, env)
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('unauthorized')
  })
  it('403 when the secret is wrong', async () => {
    const res = await app().request(`/${ID}/guarded`, { headers: { Authorization: 'Bearer nh_sk_wrong' } }, env)
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('forbidden')
  })
  it('404 when the neighborhood is unknown', async () => {
    const res = await app().request('/nope/guarded', { headers: { Authorization: 'Bearer x' } }, env)
    expect(res.status).toBe(404)
  })
  it('passes through with the correct secret', async () => {
    const res = await app().request(`/${ID}/guarded`, { headers: { Authorization: `Bearer ${SECRET}` } }, env)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, name: ID })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/auth.test.ts`
Expected: FAIL — cannot find module `../src/middleware/auth`.

- [ ] **Step 3: Write the implementation**

```ts
// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../types'
import { getDb } from '../db/client'
import { getNeighborhood } from '../db/queries'

// Constant-time string comparison. Admin secrets are fixed-length, so the
// length check does not leak useful timing information.
export function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  if (ab.length !== bb.length) return false
  let diff = 0
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i]
  return diff === 0
}

export const requireAdminSecret = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization') ?? ''
  const token = header.match(/^Bearer\s+(.+)$/)?.[1]?.trim()
  if (!token) {
    return c.json({ error: 'unauthorized', message: 'Missing bearer admin secret' }, 401)
  }

  const db = getDb(c.env.DB)
  const nb = await getNeighborhood(db, c.req.param('id')!)
  if (!nb) {
    return c.json({ error: 'neighborhood_not_found', message: 'Unknown neighborhood' }, 404)
  }
  if (!constantTimeEqual(token, nb.adminSecret)) {
    return c.json({ error: 'forbidden', message: 'Invalid admin secret' }, 403)
  }

  c.set('neighborhood', nb)
  await next()
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/auth.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/middleware/auth.ts test/auth.test.ts
git commit -m "feat: add bearer admin-secret auth middleware"
```

---

## Task 14: Management routes — create / manage / patch / delete

**Files:**
- Modify: `src/routes/neighborhoods.ts` (add `POST /`, `GET /:id/manage`, `PATCH /:id`, `DELETE /:id`)
- Test: `test/api.manage.test.ts`

**Interfaces:**
- Consumes: `zJson`, `createSchema`, `patchSchema` (Task 12); `requireAdminSecret` (Task 13); `newNeighborhoodId`, `newAdminSecret` (Task 6); query helpers (Task 10).
- Produces: the four management handlers on `neighborhoodsRoute`. `GET /:id/manage` returns editable fields + `id` (never `admin_secret`).

- [ ] **Step 1: Write the failing test**

```ts
import { SELF, env } from 'cloudflare:test'
import { describe, it, beforeAll, expect } from 'vitest'
import { getDb } from '../src/db/client'
import { seedPalettes } from '../seed/palettes'

beforeAll(async () => {
  await seedPalettes(getDb(env.DB))
})

async function create(body: unknown) {
  return SELF.fetch('https://x/v1/neighborhoods', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /v1/neighborhoods', () => {
  it('creates and returns id + admin_secret + manage_url', async () => {
    const res = await create({ name: 'Hill', timezone: 'America/Chicago', rotation_hour: 7, palette: 'rainbow' })
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, string>
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.admin_secret.startsWith('nh_sk_')).toBe(true)
    expect(body.admin_secret.slice(6).length).toBeGreaterThanOrEqual(43)
    expect(body.manage_url).toBe(`https://neighborhue.app/manage/${body.admin_secret}`)
    expect(body.palette).toBe('rainbow')
  })

  it('produces unique secrets across creates', async () => {
    const a = (await (await create({})).json()) as Record<string, string>
    const b = (await (await create({})).json()) as Record<string, string>
    expect(a.admin_secret).not.toBe(b.admin_secret)
  })

  it('rejects an unknown palette with 400', async () => {
    const res = await create({ palette: 'nope' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('palette_not_found')
  })

  it('rejects invalid timezone / rotation_hour with 400', async () => {
    expect((await create({ timezone: 'Mars/Base' })).status).toBe(400)
    expect((await create({ rotation_hour: 99 })).status).toBe(400)
  })
})

describe('GET/PATCH/DELETE management', () => {
  async function fresh() {
    const body = (await (await create({ name: 'Orig', palette: 'rainbow' })).json()) as Record<string, string>
    return body
  }

  it('manage requires auth and never returns the secret', async () => {
    const nb = await fresh()
    const noAuth = await SELF.fetch(`https://x/v1/neighborhoods/${nb.id}/manage`)
    expect(noAuth.status).toBe(401)

    const wrong = await SELF.fetch(`https://x/v1/neighborhoods/${nb.id}/manage`, {
      headers: { Authorization: 'Bearer nh_sk_wrong' },
    })
    expect(wrong.status).toBe(403)

    const ok = await SELF.fetch(`https://x/v1/neighborhoods/${nb.id}/manage`, {
      headers: { Authorization: `Bearer ${nb.admin_secret}` },
    })
    expect(ok.status).toBe(200)
    const cfg = (await ok.json()) as Record<string, unknown>
    expect(cfg).not.toHaveProperty('admin_secret')
    expect(cfg.name).toBe('Orig')
    expect(cfg.palette).toBe('rainbow')
  })

  it('patch updates fields', async () => {
    const nb = await fresh()
    const res = await SELF.fetch(`https://x/v1/neighborhoods/${nb.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${nb.admin_secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed', rotation_hour: 9, palette: 'vivid' }),
    })
    expect(res.status).toBe(200)
    const cfg = (await res.json()) as Record<string, unknown>
    expect(cfg.name).toBe('Renamed')
    expect(cfg.rotation_hour).toBe(9)
    expect(cfg.palette).toBe('vivid')
  })

  it('patch rejects invalid body with 400', async () => {
    const nb = await fresh()
    const res = await SELF.fetch(`https://x/v1/neighborhoods/${nb.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${nb.admin_secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rotation_hour: 30 }),
    })
    expect(res.status).toBe(400)
  })

  it('delete returns 204 and the neighborhood is gone', async () => {
    const nb = await fresh()
    const del = await SELF.fetch(`https://x/v1/neighborhoods/${nb.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${nb.admin_secret}` },
    })
    expect(del.status).toBe(204)
    const read = await SELF.fetch(`https://x/v1/neighborhoods/${nb.id}`)
    expect(read.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/api.manage.test.ts`
Expected: FAIL — management routes return 404 (not yet defined).

- [ ] **Step 3: Extend `src/routes/neighborhoods.ts` with management handlers**

Add these imports at the top of the file:
```ts
import { zJson, createSchema, patchSchema } from '../validators'
import { requireAdminSecret } from '../middleware/auth'
import { newNeighborhoodId, newAdminSecret } from '../lib/ids'
import {
  insertNeighborhood,
  updateNeighborhood,
  deleteNeighborhood,
  getPaletteBySlug,
} from '../db/queries'
import type { NeighborhoodInsert } from '../db/queries'
```

Add a shared config serializer and the handlers (register `POST /` and `/:id/manage` **before** relying on `/:id`; Hono matches by path shape so order is safe, but keep `manage` explicit):
```ts
async function serializeConfig(db: ReturnType<typeof getDb>, nb: NeighborhoodRow) {
  let paletteSlug: string | null = null
  if (nb.paletteId) {
    const p = await getPaletteById(db, nb.paletteId)
    paletteSlug = p?.slug ?? null
  }
  return {
    id: nb.id,
    name: nb.name,
    timezone: nb.timezone,
    rotation_hour: nb.rotationHour,
    palette: paletteSlug,
    custom_colors: nb.customColors ? (JSON.parse(nb.customColors) as unknown) : null,
  }
}

// Create
neighborhoodsRoute.post('/', zJson(createSchema), async (c) => {
  const body = c.req.valid('json')
  const db = getDb(c.env.DB)

  let paletteId: string | null = null
  if (body.palette) {
    const p = await getPaletteBySlug(db, body.palette)
    if (!p) return c.json({ error: 'palette_not_found', message: `Unknown palette: ${body.palette}` }, 400)
    paletteId = p.id
  }

  const id = newNeighborhoodId()
  const adminSecret = newAdminSecret()
  const row: NeighborhoodInsert = {
    id,
    adminSecret,
    name: body.name ?? null,
    timezone: body.timezone ?? 'UTC',
    rotationHour: body.rotation_hour ?? 7,
    paletteId,
    customColors: null,
    createdAt: Math.floor(Date.now() / 1000),
  }
  await insertNeighborhood(db, row)

  return c.json(
    {
      id,
      admin_secret: adminSecret,
      manage_url: `${c.env.MANAGE_URL_BASE}/manage/${adminSecret}`,
      name: row.name,
      timezone: row.timezone,
      rotation_hour: row.rotationHour,
      palette: body.palette ?? null,
      custom_colors: null,
    },
    201,
  )
})

// Manage (full editable config; never returns the secret)
neighborhoodsRoute.get('/:id/manage', requireAdminSecret, async (c) => {
  const db = getDb(c.env.DB)
  return c.json(await serializeConfig(db, c.get('neighborhood')))
})

// Update
neighborhoodsRoute.patch('/:id', requireAdminSecret, zJson(patchSchema), async (c) => {
  const db = getDb(c.env.DB)
  const nb = c.get('neighborhood')
  const body = c.req.valid('json')

  const patch: Partial<NeighborhoodInsert> = {}
  if (body.name !== undefined) patch.name = body.name
  if (body.timezone !== undefined) patch.timezone = body.timezone
  if (body.rotation_hour !== undefined) patch.rotationHour = body.rotation_hour
  if (body.palette !== undefined) {
    if (body.palette === null) {
      patch.paletteId = null
    } else {
      const p = await getPaletteBySlug(db, body.palette)
      if (!p) return c.json({ error: 'palette_not_found', message: `Unknown palette: ${body.palette}` }, 400)
      patch.paletteId = p.id
    }
  }
  if (body.custom_colors !== undefined) {
    patch.customColors = body.custom_colors === null ? null : JSON.stringify(body.custom_colors)
  }

  await updateNeighborhood(db, nb.id, patch)
  const updated = await getNeighborhood(db, nb.id)
  return c.json(await serializeConfig(db, updated!))
})

// Delete
neighborhoodsRoute.delete('/:id', requireAdminSecret, async (c) => {
  const db = getDb(c.env.DB)
  await deleteNeighborhood(db, c.get('neighborhood').id)
  return c.body(null, 204)
})
```

> Note: `serializeConfig`/handlers reference `NeighborhoodRow`, `getDb`, `getNeighborhood`, `getPaletteById` — all already imported by Task 11. Add only the new imports listed above.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- test/api.manage.test.ts`
Expected: PASS (all management cases).

- [ ] **Step 5: Run the whole suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: all suites green; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/routes/neighborhoods.ts test/api.manage.test.ts
git commit -m "feat: add neighborhood management CRUD endpoints"
```

---

## Task 15: `GET /v1/palettes` — list curated palettes

**Files:**
- Create: `src/routes/palettes.ts`
- Modify: `src/index.ts` (mount)
- Test: `test/api.palettes.test.ts`

**Interfaces:**
- Consumes: `listActivePalettes`, `getPaletteColors` (Task 10).
- Produces: `palettesRoute` (`Hono<AppEnv>`). Response: `{ palettes: [{ slug, name, description, colors: [{ hex, name }] }] }`.

- [ ] **Step 1: Write the failing test**

```ts
import { SELF, env } from 'cloudflare:test'
import { describe, it, beforeAll, expect } from 'vitest'
import { getDb } from '../src/db/client'
import { seedPalettes } from '../seed/palettes'

beforeAll(async () => {
  await seedPalettes(getDb(env.DB))
})

describe('GET /v1/palettes', () => {
  it('lists the seeded palettes with colors', async () => {
    const res = await SELF.fetch('https://x/v1/palettes')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { palettes: Array<{ slug: string; colors: unknown[] }> }
    const slugs = body.palettes.map((p) => p.slug)
    expect(slugs).toContain('rainbow')
    expect(slugs.length).toBe(7)
    const rainbow = body.palettes.find((p) => p.slug === 'rainbow')!
    expect(rainbow.colors.length).toBe(7)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/api.palettes.test.ts`
Expected: FAIL — route not mounted (404).

- [ ] **Step 3: Write `src/routes/palettes.ts`**

```ts
// src/routes/palettes.ts
import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { getDb } from '../db/client'
import { listActivePalettes, getPaletteColors } from '../db/queries'

export const palettesRoute = new Hono<AppEnv>()

palettesRoute.get('/', async (c) => {
  const db = getDb(c.env.DB)
  const list = await listActivePalettes(db)
  const palettes = await Promise.all(
    list.map(async (p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description,
      colors: (await getPaletteColors(db, p.id)).map((col) => ({ hex: col.hex, name: col.name })),
    })),
  )
  return c.json({ palettes })
})
```

- [ ] **Step 4: Mount in `src/index.ts`**

```ts
import { palettesRoute } from './routes/palettes'
// ...
app.route('/v1/palettes', palettesRoute)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- test/api.palettes.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/palettes.ts src/index.ts test/api.palettes.test.ts
git commit -m "feat: add palettes list endpoint"
```

---

## Task 16: CORS, README, and full-suite green

**Files:**
- Modify: `src/index.ts` (CORS)
- Create: `README.md`
- Test: `test/api.cors.test.ts`

**Interfaces:**
- Produces: public reads send `Access-Control-Allow-Origin: *`; management methods/paths use `CORS_ORIGIN`. README documents setup, endpoints, the HA REST-sensor example, and that write-endpoint rate limiting is applied at the Cloudflare dashboard (per design D6).

- [ ] **Step 1: Write the failing test**

```ts
import { SELF } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'

describe('CORS', () => {
  it('allows any origin on public reads', async () => {
    const res = await SELF.fetch('https://x/v1/palettes', { headers: { Origin: 'https://anywhere.example' } })
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/api.cors.test.ts`
Expected: FAIL — no `Access-Control-Allow-Origin` header yet.

- [ ] **Step 3: Add CORS to `src/index.ts`**

Add the import and a single dynamic CORS middleware over `/v1/*` (place it **before** the `app.route(...)` mounts):
```ts
import { cors } from 'hono/cors'

// Public GET reads: any origin. Management (writes + /manage): the configured
// frontend origin only. Bearer secret is the real auth boundary; CORS is
// defense-in-depth for the browser frontend.
app.use('/v1/*', (c, next) => {
  const path = new URL(c.req.url).pathname
  const isManagement = c.req.method !== 'GET' || path.endsWith('/manage')
  const origin = isManagement ? (c.env.CORS_ORIGIN ?? '') : '*'
  return cors({
    origin,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'If-None-Match'],
  })(c, next)
})
```

- [ ] **Step 4: Write `README.md`**

````markdown
# Neighborhue API

A stateless Cloudflare Worker that returns a deterministic **shared daily color**
for a neighborhood. Devices poll one endpoint and all show the same color, which
rotates once a day at a locally chosen hour. Colors are computed from
`(neighborhood_id, day_index)` — never stored, no cron.

## Develop

```bash
npm install
npm test          # vitest (Workers pool)
npm run dev       # wrangler dev
```

## Provision (one-time)

```bash
npx wrangler d1 create neighborhue      # copy database_id into wrangler.toml
npm run db:generate                     # generate migrations from schema
npm run db:migrate:local                # apply locally
npm run seed:local                      # seed the 7 palettes locally
```

## Deploy

```bash
npm run db:migrate:remote
npm run seed:remote
npm run deploy
```

## Endpoints (`/v1`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/v1/neighborhoods/:id` | — | Today's color (`?format=hex|rgb` for text/plain) |
| POST | `/v1/neighborhoods` | — | Create; returns `id` + `admin_secret` + `manage_url` |
| GET | `/v1/neighborhoods/:id/manage` | Bearer | Editable config |
| PATCH | `/v1/neighborhoods/:id` | Bearer | Update |
| DELETE | `/v1/neighborhoods/:id` | Bearer | Delete |
| GET | `/v1/palettes` | — | List curated palettes |

Management auth: `Authorization: Bearer <admin_secret>`. Errors: `{ "error", "message" }`.

> **Rate limiting:** apply Cloudflare dashboard rate-limiting rules to the write
> endpoints (`POST`/`PATCH`/`DELETE`). The Worker itself stays stateless.

## Home Assistant

```yaml
sensor:
  - platform: rest
    name: neighborhue
    resource: https://api.neighborhue.app/v1/neighborhoods/<your-id>
    value_template: "{{ value_json.color.hex }}"
    json_attributes_path: "$.color"
    json_attributes: [hex, rgb, hsl]
    scan_interval: 900

automation:
  - alias: "Neighborhue — apply daily color"
    trigger:
      - platform: state
        entity_id: sensor.neighborhue
    action:
      - service: light.turn_on
        target: { entity_id: light.porch }
        data:
          rgb_color: "{{ state_attr('sensor.neighborhue','rgb') }}"
```

The `color.rgb` array is a drop-in for `rgb_color:` — no parsing needed.
````

- [ ] **Step 5: Run the whole suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: every suite green (`hash`, `pick`, `color`, `rotation`, `ids`, `db`, `seed`, `resolve`, `queries`, `auth`, `validators`, `api.read`, `api.manage`, `api.palettes`, `api.cors`, `smoke`); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts README.md test/api.cors.test.ts
git commit -m "feat: finalize CORS and add README with Home Assistant example"
```

---

## Task 17: Live provisioning and deploy (ops — confirm before each account command)

> **Wrangler is installed and the user authorized live ops (design D9), but confirm with the user before EACH account-touching command below.** Everything before this task runs fully locally.

**Files:**
- Modify: `wrangler.toml` (real `database_id`)

- [ ] **Step 1: Confirm + create the D1 database**

Ask the user to confirm, then run: `npx wrangler d1 create neighborhue`
Copy the returned `database_id` into `wrangler.toml`'s `[[d1_databases]]` block (replace the `placeholder-set-in-task-17`).

- [ ] **Step 2: Commit the database id**

```bash
git add wrangler.toml
git commit -m "chore: set D1 database_id"
```

- [ ] **Step 3: Apply migrations remotely (confirm first)**

Run: `npm run db:migrate:remote`
Expected: the `0000_*` migration applies to the remote `neighborhue` D1.

- [ ] **Step 4: Seed palettes remotely (confirm first)**

Run: `npm run seed:remote`
Expected: 7 palettes + their colors inserted (idempotent `INSERT OR IGNORE`).

- [ ] **Step 5: Deploy (confirm first)**

Run: `npm run deploy`
Expected: the Worker deploys; note the `*.workers.dev` URL (and/or the `api.neighborhue.app` route once DNS is configured).

- [ ] **Step 6: Smoke-test production**

Run:
```bash
curl -s https://<deployed-host>/v1/palettes | head -c 400
```
Expected: JSON listing the 7 palettes. Then create a neighborhood and read it:
```bash
curl -s -X POST https://<deployed-host>/v1/neighborhoods -H 'content-type: application/json' -d '{"name":"Test","palette":"rainbow"}'
```
Confirm `id` + `admin_secret` returned, and `GET /v1/neighborhoods/<id>` returns a color with an `rgb` array.

---

## Self-Review

**1. Spec coverage** — every acceptance criterion in design §9 / base spec §8 maps to a task:

| Requirement | Task(s) |
|---|---|
| Same `(id, dayIndex, n)` → same index | 3 |
| Every index once per n-day (cycle) window | 3 |
| Cross-neighborhood divergence | 3 |
| Before/at rotationHour → yesterday/today | 5 |
| `next_rotation_at` correct across spring-forward & fall-back | 5 |
| `day_index` +1/day, consistent (sample 9692) | 5 |
| `seconds_until_rotation` positive & consistent | 5 |
| Known hex → rgb/hsl; invalid hex rejected | 4 |
| Create returns `id`+`admin_secret` (≥32B, unique) | 6, 14 |
| Full read shape + cache headers; unknown → 404 | 11 |
| `?format=hex|rgb` text/plain | 11 |
| `If-None-Match` → 304 | 11 |
| Auth matrix 401/403/success | 13, 14 |
| Invalid tz / hour / custom_colors → 400 | 12, 14 |
| `GET /v1/palettes` lists seeded palettes | 15 |
| Color source resolution (custom→palette→default) | 9, 11 |
| `manage` never returns secret | 14 |
| Seven bulb-safe palettes, rainbow default | 8 |
| CORS public vs management | 16 |
| Rate limiting deferred to Cloudflare (documented) | 16 (README) |
| Deploy + seed remote | 17 |

**2. Placeholder scan** — no `TBD`/`TODO` except the one intentional, documented `TODO(v1)` cycle-boundary note in `pick.ts` (design D2). The `wrangler.toml` `database_id` placeholder is explicitly resolved in Task 17.

**3. Type consistency** — shared names verified across tasks: `getDb`/`DB`, `AppEnv`, `NeighborhoodRow`/`NeighborhoodInsert`, `ColorEntry`, `Color`, `RotationInfo`, `seedPalettes`/`PALETTES`, `zJson`, `requireAdminSecret`, `pickColorIndex`, `rotation`, `buildColor`, `resolveColorList`/`parseCustomColors`. Query helper signatures in Task 10 match their call sites in Tasks 11/14/15.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-15-neighborhue-backend.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
