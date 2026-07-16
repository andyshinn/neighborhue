# Neighborhue Backend — Build Brief

> Hand this document to Claude Code (or any implementer) to build the Neighborhue API from scratch.
> It is self-contained: stack, data model, algorithms, full API contract, and acceptance tests.

---

## 1. What Neighborhue is

Neighborhue is a tiny service that gives a **neighborhood** a **shared color that changes once a day**. People in the same neighborhood point their smart-home devices (lights, LEDs) at the same URL and all display the same color, rotating to a new hue each morning at a local time they choose.

The first consumer is **Home Assistant**, which will poll a single endpoint on an interval and drive light colors from the response. Design the API around that: stable JSON, an `rgb` array ready to drop into a light call, and explicit rotation timestamps.

### Core design decision: colors are deterministic, not stored

The color for a neighborhood on a given day is **computed on read** as a pure function of the neighborhood's identity and the day, not picked randomly and written to a table. This is the single most important property of the system. It means:

- **No scheduler / cron.** "Rotation" is just the day index changing. Nothing runs in the background.
- **No per-day rows.** The database holds only neighborhood config; it never stores daily colors.
- **Exact timestamps for free.** `rotated_at` and `next_rotation_at` are computed, not guessed.
- **Edge-cacheable.** The response is pure and changes only at a computable instant, so it caches perfectly with `Cache-Control` + `ETag` until the next rotation.

Guessing future colors is explicitly **fine** — synchronization is the point, secrecy is not. So no secret seed is needed; a plain hash of `(neighborhood_id, day_index)` is the selector.

---

## 2. Stack & deployment

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict) | |
| Framework | **Hono** | Runs on Web Standards; deploys to Cloudflare Workers |
| Runtime / deploy | **Cloudflare Workers** | via `wrangler` |
| Storage | **Cloudflare D1** (serverless SQLite) | One small config schema; bound as `DB` |
| ORM / queries | **Drizzle ORM** (`drizzle-orm/d1`) | Type-safe schema + `drizzle-kit` migrations |
| Validation | **Zod** + `@hono/zod-validator` | Validate all write bodies |
| Timezone math | **Luxon** | IANA zones + DST-safe day arithmetic (uses Workers' Intl) |
| Tests | **Vitest** + `@cloudflare/vitest-pool-workers` | Run against the Workers runtime |
| Package manager | npm (or pnpm — implementer's choice) | |

> **Implementer note:** Before writing code, pull current docs via Context7 for `hono`, `drizzle-orm`, `@hono/zod-validator`, and `@cloudflare/vitest-pool-workers`, since minor APIs drift. The snippets below are illustrative of the intended shape, not pinned to a version.

Color conversion (hex → rgb → hsl) is trivial math — implement it in `lib/color.ts` with no dependency (see §5.4). A library like `colord` is acceptable but not required.

---

## 3. Data model (D1 / Drizzle)

Three tables. Neighborhoods hold all per-area config; palettes are curated starter sets shared across neighborhoods. **There is deliberately no `daily_colors` / `neighborhood_colors` table** — daily colors are computed, never stored.

```ts
// src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const neighborhoods = sqliteTable('neighborhoods', {
  id:           text('id').primaryKey(),            // public UUID v4 — goes in the share URL
  adminSecret:  text('admin_secret').notNull().unique(), // separate unguessable token for management
  name:         text('name'),
  timezone:     text('timezone').notNull().default('UTC'), // IANA, e.g. "America/Chicago"
  rotationHour: integer('rotation_hour').notNull().default(7), // 0–23, local hour the color flips
  paletteId:    text('palette_id').references(() => palettes.id), // nullable; curated set to draw from
  customColors: text('custom_colors'),              // nullable JSON: [{ "hex": "#RRGGBB", "name": "..." }]
  createdAt:    integer('created_at').notNull(),    // unix seconds
})

export const palettes = sqliteTable('palettes', {
  id:          text('id').primaryKey(),
  slug:        text('slug').notNull().unique(),     // "rainbow", "rainbow-warm-white"
  name:        text('name').notNull(),
  description: text('description'),
  isDefault:   integer('is_default', { mode: 'boolean' }).notNull().default(false),
  isActive:    integer('is_active', { mode: 'boolean' }).notNull().default(true),
})

export const paletteColors = sqliteTable('palette_colors', {
  id:        text('id').primaryKey(),
  paletteId: text('palette_id').notNull().references(() => palettes.id, { onDelete: 'cascade' }),
  hex:       text('hex').notNull(),                 // "#RRGGBB"
  name:      text('name'),
  position:  integer('position').notNull().default(0), // stable ordering — matters for determinism (see §5.3)
})
```

**Color source resolution** for a neighborhood: if `customColors` is a non-empty JSON array, draw from it; otherwise draw from the linked `paletteId`'s colors ordered by `position`; if neither is set, fall back to the default palette (`isDefault = true`).

> **Determinism caveat to preserve:** the ordered list of colors a neighborhood draws from is the input to the selector. Always order palette colors by `position` (then `id` as a tiebreak) so the sequence is stable. Editing a neighborhood's colors intentionally re-sequences future days — that's expected and fine. Because the API serves **today only** (no history), past days are never recomputed, so re-sequencing has no visible downside.

### Seed data (carry over from the old app)

Seed two palettes on first deploy:

- **`rainbow`** — "Rainbow Colors" (default): `#FF0000 Red`, `#FF8000 Orange`, `#FFD700 Yellow`, `#00FF00 Green`, `#0080FF Blue`, `#4B0082 Indigo`, `#8000FF Violet`
- **`rainbow-warm-white`** — "Rainbow + Warm White": the seven above plus `#FDF4DC Warm White`

---

## 4. The two algorithms (this is the heart of the service)

### 4.1 Rotation timing — DST-safe, no cron

Given a neighborhood's `timezone` (IANA) and `rotationHour` (0–23), and the current instant, compute the current color-day and the rotation timestamps. Work entirely in **local wall-clock time** so DST is handled automatically.

```ts
// src/lib/rotation.ts
import { DateTime } from 'luxon'

const EPOCH = { year: 2000, month: 1, day: 1 } // fixed reference for day indexing

export interface RotationInfo {
  dayIndex: number          // stable integer identifying the current color-day
  rotatedAt: string         // ISO instant the current color-day began (UTC)
  nextRotationAt: string    // ISO instant the next rotation occurs (UTC)
  secondsUntilRotation: number
}

export function rotation(timezone: string, rotationHour: number, now = DateTime.utc()): RotationInfo {
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

Key correctness points to cover in tests:
- Before `rotationHour` local, the color-day is *yesterday's*; at/after, it's *today's*.
- `nextRotationAt` lands on the same wall-clock hour the day after even across a DST transition (so the gap may be 23h or 25h of real time, but always "next 7 AM local").
- `dayIndex` increments by exactly 1 each color-day, in every timezone.

### 4.2 Color selection — deterministic, even, no back-to-back repeats

Select a color from the neighborhood's ordered color list using `(neighborhood_id, dayIndex)`. Use a per-cycle seeded shuffle so that within each run of `n` days (n = number of colors) every color appears exactly once (even distribution), and consecutive cycles use different orders.

```ts
// src/lib/hash.ts — small, stable, runtime-independent
export function strHash(s: string): number {          // FNV-1a 32-bit
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
export function mulberry32(seed: number): () => number { // deterministic PRNG
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

```ts
// src/lib/pick.ts
import { strHash, mulberry32 } from './hash'

export function pickColorIndex(neighborhoodId: string, dayIndex: number, n: number): number {
  if (n <= 0) throw new Error('empty color list')
  if (n === 1) return 0
  const cycle = Math.floor(dayIndex / n)
  const pos = ((dayIndex % n) + n) % n
  // Seeded Fisher-Yates permutation of [0..n) for this (neighborhood, cycle)
  const rnd = mulberry32(strHash(`${neighborhoodId}:${cycle}`))
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order[pos]
}
```

The only possible adjacent repeat is at a cycle boundary (last color of one cycle equal to first of the next). Acceptable for v1; if you want to eliminate it, reshuffle the next cycle until `order[0] !== previousCycleLast`. Note this as a TODO, don't over-engineer.

> **Baseline alternative** (simpler, acceptable if the shuffle feels like too much): `index = strHash(`${id}:${dayIndex}`) % n`. Even distribution isn't guaranteed and back-to-back repeats are possible. The shuffle above is the recommended default.

---

## 5. API contract

Version everything under `/v1`. All responses are JSON unless a text format is requested.

### 5.1 Public: get today's color (the single call HA uses)

```
GET /v1/neighborhoods/:id
```

`200 OK`:
```json
{
  "id": "51fbbdef-62a7-4d19-b1b2-c91e1d721d20",
  "name": "Sunset Hill",
  "timezone": "America/Chicago",
  "rotation_hour": 7,
  "color": {
    "hex": "#E4572E",
    "rgb": [228, 87, 46],
    "hsl": [14, 78, 54],
    "name": "Sunset Orange"
  },
  "rotated_at": "2026-07-15T12:00:00.000Z",
  "next_rotation_at": "2026-07-16T12:00:00.000Z",
  "seconds_until_rotation": 51230,
  "palette": "rainbow",
  "day_index": 9692
}
```

Response headers (important for HA + any CDN in front):
```
Cache-Control: public, max-age=<seconds_until_rotation>
ETag: "<neighborhood_id>-<day_index>"
```
Honor `If-None-Match` and return `304` when the ETag matches.

`404 Not Found` if the id is unknown: `{ "error": "neighborhood_not_found" }`.

**Convenience formats** for easy templating on devices:
- `GET /v1/neighborhoods/:id?format=hex` → `text/plain` body `#E4572E`
- `GET /v1/neighborhoods/:id?format=rgb` → `text/plain` body `228,87,46`

(A bare `Accept: text/plain` may map to `format=hex`. Keep it simple.)

### 5.2 Management (creator actions)

No user accounts. Management is authorized by the neighborhood's **`admin_secret`**, passed as `Authorization: Bearer <admin_secret>`. The `admin_secret` is distinct from the public `id`: the public id is shareable and read-only; the secret controls the neighborhood. Losing the secret is not catastrophic — the creator can just make a new neighborhood.

```
POST   /v1/neighborhoods                 # create
GET    /v1/neighborhoods/:id/manage      # full editable config (auth)
PATCH  /v1/neighborhoods/:id             # update (auth)
DELETE /v1/neighborhoods/:id             # delete (auth)
GET    /v1/palettes                      # list curated palettes (public)
```

**Create** — `POST /v1/neighborhoods`
Body (all optional; sensible defaults applied):
```json
{ "name": "Sunset Hill", "timezone": "America/Chicago", "rotation_hour": 7, "palette": "rainbow" }
```
`201 Created` returns the config **plus the secret and a management URL** (the only time the secret is returned in a create flow that a browser can also stash in a cookie):
```json
{
  "id": "51fbbdef-...",
  "admin_secret": "nh_sk_2f9a...<32+ bytes base64url>",
  "manage_url": "https://<frontend>/manage/nh_sk_2f9a...",
  "name": "Sunset Hill",
  "timezone": "America/Chicago",
  "rotation_hour": 7,
  "palette": "rainbow",
  "custom_colors": null
}
```
Generate `id` with `crypto.randomUUID()`. Generate `admin_secret` from `crypto.getRandomValues` (≥ 32 bytes, base64url, with a short human-readable prefix like `nh_sk_`).

**Update** — `PATCH /v1/neighborhoods/:id` (auth). Any subset of: `name`, `timezone` (validate against IANA — reject unknown zones), `rotation_hour` (0–23), `palette` (slug or null), `custom_colors` (array of `{hex,name?}` with `#RRGGBB` validation, or null to clear). Returns updated config.

**Delete** — `DELETE /v1/neighborhoods/:id` (auth) → `204`.

**Auth failures:** missing/blank secret → `401 unauthorized`; wrong secret for that id → `403 forbidden`. Compare secrets with a constant-time comparison.

### 5.3 Cross-cutting

- **CORS:** public `GET` endpoints allow any origin (`origin: '*'`). Management endpoints allow only the frontend origin(s), configured via an env var (`CORS_ORIGIN`), with `credentials` as needed if the frontend uses a cookie.
- **Rate limiting:** put Cloudflare's built-in rate limiting (or a lightweight per-IP limit) in front of write endpoints. Reads are cache-friendly and low-risk.
- **Errors:** consistent shape `{ "error": "<snake_case_code>", "message": "<human readable>" }`.
- **Content types:** JSON by default; `text/plain` only for the `format=` convenience reads.

### 5.4 Color conversion (`lib/color.ts`)

Implement `hexToRgb(hex): [r,g,b]` and `rgbToHsl(r,g,b): [h,s,l]` (h in 0–360, s/l in 0–100, rounded to integers) with no dependency. Validate hex as `^#[0-9A-Fa-f]{6}$`. Build the `color` object from the selected palette entry (`hex` + `name`) plus derived `rgb` and `hsl`.

---

## 6. Project layout

```
neighborhue-api/
├── src/
│   ├── index.ts               # Hono app: bindings type, mounts routes, CORS, error handler
│   ├── routes/
│   │   ├── neighborhoods.ts    # public read + management CRUD
│   │   └── palettes.ts         # GET /v1/palettes
│   ├── lib/
│   │   ├── rotation.ts         # §4.1 — Luxon day/rotation math
│   │   ├── pick.ts             # §4.2 — deterministic selection
│   │   ├── hash.ts             # §4.2 — FNV-1a + mulberry32
│   │   ├── color.ts            # §5.4 — hex/rgb/hsl
│   │   └── ids.ts              # uuid + admin secret generation
│   ├── db/
│   │   ├── schema.ts           # §3 — Drizzle tables
│   │   └── client.ts           # drizzle(c.env.DB)
│   ├── middleware/
│   │   └── auth.ts             # bearer admin-secret guard (constant-time compare)
│   └── validators.ts           # Zod schemas for create/patch bodies
├── migrations/                 # drizzle-kit output (wrangler migrations_dir)
├── seed/palettes.ts            # seeds rainbow + rainbow-warm-white
├── test/
│   ├── rotation.test.ts
│   ├── pick.test.ts
│   ├── color.test.ts
│   └── api.test.ts
├── drizzle.config.ts           # dialect: 'sqlite', driver: 'd1-http'
├── wrangler.toml               # [[d1_databases]] binding = "DB", migrations_dir = "migrations"
├── tsconfig.json               # strict: true
├── package.json
├── README.md
└── CLAUDE.md                   # (provided separately)
```

Illustrative wiring (confirm against current docs):

```ts
// src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = { DB: D1Database; CORS_ORIGIN: string }
const app = new Hono<{ Bindings: Bindings }>()

app.use('/v1/*', cors({ origin: '*' })) // tighten for management routes
// ... mount routes/neighborhoods.ts and routes/palettes.ts
export default app
```

```toml
# wrangler.toml
name = "neighborhue-api"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[[d1_databases]]
binding = "DB"
database_name = "neighborhue"
database_id = "<from wrangler d1 create>"
migrations_dir = "migrations"
```

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

---

## 7. Home Assistant integration (design target — ship an example in the README)

A [RESTful sensor](https://www.home-assistant.io/integrations/sensor.rest/) polls the neighborhood endpoint and exposes the color; an automation drives a light from it.

```yaml
# configuration.yaml
sensor:
  - platform: rest
    name: neighborhue
    resource: https://api.neighborhue.example/v1/neighborhoods/51fbbdef-62a7-4d19-b1b2-c91e1d721d20
    value_template: "{{ value_json.color.hex }}"
    json_attributes_path: "$.color"
    json_attributes:
      - hex
      - rgb
      - hsl
    scan_interval: 900   # 15 min; response Cache-Control makes this cheap

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

The `rgb` array exists specifically so this `rgb_color:` line needs no parsing. Keep that guarantee.

---

## 8. Acceptance criteria (what "done" means)

Build these as the Vitest suite:

**Determinism & selection**
- Same `(id, dayIndex, n)` → same index every call.
- Over any window of `n` consecutive days, every color index appears exactly once (per-cycle shuffle).
- Two different neighborhoods with the same palette generally differ on the same day.

**Rotation math**
- Just before `rotationHour` local → color-day is yesterday's; at/after → today's.
- `next_rotation_at` is the next `rotationHour` local, correct across a US spring-forward and fall-back date in `America/Chicago`.
- `day_index` increments by exactly 1 per color-day and is consistent across timezones.
- `seconds_until_rotation` is positive and matches `next_rotation_at − now`.

**Color conversion**
- Known hex values convert to expected rgb/hsl (spot-check a few, e.g. `#FF0000` → `[255,0,0]` / `[0,100,50]`).
- Invalid hex is rejected.

**API**
- `POST /v1/neighborhoods` returns `id` + `admin_secret`; the secret is ≥ 32 bytes of entropy and unique.
- `GET /v1/neighborhoods/:id` returns the full shape with correct cache headers; unknown id → `404`.
- `?format=hex` / `?format=rgb` return correct `text/plain`.
- `If-None-Match` with the current ETag → `304`.
- `PATCH`/`DELETE` require the correct secret: no secret → `401`, wrong secret → `403`, right secret → success.
- Invalid `timezone`, `rotation_hour` out of 0–23, or malformed `custom_colors` → `400`.
- `GET /v1/palettes` lists the two seeded palettes.

**Non-goals for v1 (explicitly out of scope):** user accounts / OAuth, storing daily colors, color history endpoints, webhooks, the Next.js frontend, and the Home Assistant client package (separate repo). Keep the Worker stateless apart from D1 config.

---

## 9. Build order (suggested for the implementer)

1. Scaffold: `npm create hono@latest` (Cloudflare Workers template) or equivalent; add Drizzle, Zod, `@hono/zod-validator`, Luxon, Vitest + workers pool.
2. `lib/hash.ts`, `lib/pick.ts`, `lib/color.ts`, `lib/rotation.ts` **with unit tests first** — these are pure and are the core; get them green before touching the DB.
3. `db/schema.ts` + `drizzle.config.ts` + `wrangler.toml`; `wrangler d1 create neighborhue`; generate & apply migrations; write `seed/palettes.ts`.
4. Public read route (`GET /v1/neighborhoods/:id` + formats + caching/ETag).
5. Management routes (create/patch/delete) + `auth.ts` + Zod validators.
6. `GET /v1/palettes`.
7. Full `api.test.ts` against the Workers test runtime; README with the HA example.
8. `wrangler deploy`.