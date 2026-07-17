# Neighborhue Backend — Design

**Date:** 2026-07-15
**Status:** Approved for planning
**Base spec:** [`docs/specs/initial-spec.md`](../../specs/initial-spec.md) — the self-contained build brief. This document is the authoritative *design*: it adopts the base spec wholesale and records the decisions the spec left to the implementer, one deviation, and the expanded palette seed data. Where this document and CLAUDE.md disagree, this document wins.

---

## 1. Core principle (unchanged, load-bearing)

The color for a neighborhood on a given day is **computed on read** as a pure function of `(neighborhood_id, day_index)` — never stored, never randomly picked. Everything below preserves this:

- **No scheduler / cron.** "Rotation" is the day index changing.
- **No per-day rows.** No `daily_colors` / `neighborhood_colors` table exists or will be added. D1 holds only config.
- **Exact timestamps for free.** `rotated_at` / `next_rotation_at` are computed.
- **Edge-cacheable.** Responses are pure and change only at a computable instant, cached with `Cache-Control` + `ETag`.
- **Secrecy is a non-goal.** Guessing future colors is fine; no secret seed. A plain hash of `(neighborhood_id, day_index)` drives selection.

---

## 2. Stack

TypeScript (strict) · Hono · Cloudflare Workers · D1 (bound as `DB`) · Drizzle ORM (`drizzle-orm/d1`) · Zod + `@hono/zod-validator` · Luxon · Vitest + `@cloudflare/vitest-pool-workers`. Package manager: **pnpm** (migrated from npm on 2026-07-16, along with Biome for lint/format).

> Before the coding phase, pull current docs via Context7 for `hono`, `drizzle-orm`, `@hono/zod-validator`, and `@cloudflare/vitest-pool-workers` — minor APIs drift. Reference snippets in the base spec are illustrative, not version-pinned.

---

## 3. Resolved decisions

These are the choices the base spec delegated to the implementer, plus one deviation and the interactive decisions made during brainstorming.

| # | Decision | Resolution | Rationale |
|---|---|---|---|
| D1 | Color selection algorithm | **Per-cycle seeded Fisher-Yates shuffle** (base spec §4.2 recommended default). The `hash % n` baseline is rejected. | Acceptance criteria require "every color index appears exactly once over any n-day window" — only the shuffle satisfies this. |
| D2 | Cycle-boundary adjacent repeat | **Left as a documented TODO** in `pick.ts`. Not eliminated in v1. | Base spec §4.2 says acceptable for v1; don't over-engineer. |
| D3 | Management read route | **`GET /:id` = public read; `GET /:id/manage` = full editable config (auth).** | Base spec §5.2. Resolves CLAUDE.md, which confusingly lists `GET /:id` as both the public read and a management route. This document overrides CLAUDE.md. |
| D4 | `manage_url` base | Env var **`MANAGE_URL_BASE`**, default `https://neighborhue.app`. Create response returns `` `${MANAGE_URL_BASE}/manage/${admin_secret}` ``. | Needs a real base; the domain is `neighborhue.app`. |
| D5 | `palette` field in public response | The linked palette **slug** if one is set, else `null` — including when `custom_colors` is the active color source. | Simple, honest reflection of the config; custom colors aren't a palette. |
| D6 | Rate limiting | **No rate-limiting code in the Worker.** Document that Cloudflare dashboard rate-limiting rules should be applied to `POST`/`PATCH`/`DELETE`. | "Keep the Worker stateless apart from D1 config" is a hard constraint; an in-Worker per-IP limiter needs KV/DO/binding state. |
| D7 | "Random" creation mode | Not a separate code path. **A large curated `mixed` palette** (~20 saturated, bulb-tested hues) that reuses the same deterministic pick. Selecting "random/surprise" = create with `palette: "mixed"`. | Zero new code, no schema change, still guaranteed bulb-safe. |
| D8 | Seed palettes | Seven palettes (see §7). Default remains **`rainbow`**. | Expanded from the base spec's two to give bulb-friendly variety without arbitrary hex. |
| D9 | Live Cloudflare ops | Wrangler is installed and authorized. Provisioning + deploy may run, but **confirm before each account-touching command** (`d1 create`, remote `migrations apply`, `deploy`). | User authorized live ops with per-command confirmation. |

**LED reproduction rationale (D7/D8):** cheap RGB LED bulbs reproduce *saturated* primary/secondary hues well but struggle with whites and desaturated pastels (an RGB bulb can't make a clean white — warm-white needs RGBW/CCT). All curated palettes are therefore high-saturation and bulb-tested; warm-white stays an explicit opt-in (`rainbow-warm-white` only).

---

## 4. Architecture & module boundaries

A single stateless Hono Worker on Cloudflare Workers. The only persistent state is D1 config. Pure `lib/*` core is testable with no DB and must be green before any DB/route work.

| Unit | Purpose | Depends on |
|---|---|---|
| `src/lib/hash.ts` | FNV-1a 32-bit `strHash` + `mulberry32` PRNG; runtime-independent | — |
| `src/lib/pick.ts` | `pickColorIndex(id, dayIndex, n)` via per-cycle Fisher-Yates | hash |
| `src/lib/rotation.ts` | `rotation(tz, hour, now)` → `{ dayIndex, rotatedAt, nextRotationAt, secondsUntilRotation }`, DST-safe | luxon |
| `src/lib/color.ts` | `hexToRgb`, `rgbToHsl`, hex validation, build `color` object | — |
| `src/lib/ids.ts` | `crypto.randomUUID()` id + `nh_sk_`-prefixed admin secret (≥32 bytes, base64url) | Web Crypto |
| `src/db/schema.ts` | Drizzle tables `neighborhoods`, `palettes`, `palette_colors` | drizzle |
| `src/db/client.ts` | `drizzle(env.DB)` | drizzle |
| `src/middleware/auth.ts` | `Authorization: Bearer <admin_secret>` guard, constant-time compare | ids, db |
| `src/validators.ts` | Zod schemas for create/patch bodies (IANA tz, hour 0–23, `#RRGGBB`) | zod |
| `src/routes/neighborhoods.ts` | public read (+ formats, ETag/304, cache) + management CRUD | all above |
| `src/routes/palettes.ts` | `GET /v1/palettes` | db |
| `src/index.ts` | Hono app: `Bindings` type, mounts routes, CORS, error handler | routes |

Each unit has one purpose and a narrow interface; the pure core (`hash`, `pick`, `rotation`, `color`, `ids`) has no DB dependency and is unit-tested in isolation.

---

## 5. Data model (unchanged from base spec §3)

Three tables: `neighborhoods`, `palettes`, `palette_colors`. **No `daily_colors` table.** Exact Drizzle definitions per base spec §3 — this design adds no columns.

**Color source resolution** for a neighborhood: non-empty `custom_colors` JSON array → else linked `palette_id`'s colors ordered by `position` (tiebreak `id`) → else the default palette (`is_default = true`, i.e. `rainbow`). Serve **today only**; no history, so re-sequencing on edit is safe.

---

## 6. The two algorithms (unchanged from base spec §4)

- **§4.1 Rotation timing** — Luxon, local wall-clock, DST-safe; `EPOCH = 2000-01-01`; `dayIndex` from the calendar date of the color-day start; `nextRotationAt` lands on the same wall-clock hour next day across DST (gap may be 23h/25h).
- **§4.2 Color selection** — `strHash` (FNV-1a) + `mulberry32`; per-cycle Fisher-Yates permutation of `[0..n)` seeded by `` `${neighborhoodId}:${cycle}` ``; `cycle = floor(dayIndex/n)`, `pos = ((dayIndex % n) + n) % n`. `n === 1` → `0`; `n <= 0` → throw. Cycle-boundary adjacent repeat = TODO (D2).

Reference implementations in base spec §4 are the intended shape; verify APIs against Context7 before coding.

---

## 7. Palettes & seed data

Seed **seven** palettes on first deploy via `seed/palettes.ts` (`npm run seed`). `rainbow` is the only `is_default`. All colors are valid `^#[0-9A-Fa-f]{6}$` and high-saturation. `position` is the listed order (0-based); `palette_colors.id` generated per row (uuid) with `position` as the stable sort key.

### 7.1 `rainbow` — "Rainbow Colors" (default)
`#FF0000` Red · `#FF8000` Orange · `#FFD700` Yellow · `#00FF00` Green · `#0080FF` Blue · `#4B0082` Indigo · `#8000FF` Violet

### 7.2 `rainbow-warm-white` — "Rainbow + Warm White"
The seven above **plus** `#FDF4DC` Warm White. *(Warm white assumes an RGBW/CCT bulb.)*

### 7.3 `mixed` — "Mixed (Surprise)" — the "random" option
Twenty saturated hues evenly spaced around the wheel (HSL S=100, L=50):
`#FF0000` Red · `#FF4D00` Vermilion · `#FF9900` Orange · `#FFE600` Gold · `#CCFF00` Chartreuse · `#80FF00` Lime · `#33FF00` Bright Green · `#00FF1A` Green · `#00FF66` Spring Green · `#00FFB3` Aquamarine · `#00FFFF` Cyan · `#00B3FF` Sky Blue · `#0066FF` Azure · `#001AFF` Blue · `#3300FF` Indigo · `#8000FF` Violet · `#CC00FF` Purple · `#FF00E6` Magenta · `#FF0099` Rose · `#FF004D` Crimson

### 7.4 `vivid` — "Vivid / Neon"
`#FF073A` Electric Red · `#FF6700` Electric Orange · `#FFF700` Electric Yellow · `#39FF14` Electric Green · `#00FFFF` Electric Cyan · `#3D5AFF` Electric Blue · `#BC13FE` Electric Purple · `#FF10F0` Electric Magenta · `#FF3CAC` Electric Pink

### 7.5 `warm` — "Warm"
`#FF0000` Red · `#FF3300` Scarlet · `#FF6600` Orange · `#FF9900` Amber · `#FFCC00` Gold · `#FF0066` Raspberry · `#FF00AA` Warm Magenta · `#FF1493` Deep Pink

### 7.6 `cool` — "Cool"
`#00FF00` Green · `#00FF99` Spring Green · `#00FFCC` Turquoise · `#00FFFF` Cyan · `#0099FF` Sky Blue · `#0033FF` Blue · `#6600FF` Indigo · `#9900FF` Violet

### 7.7 `primary` — "Primary & Secondary"
Pure additive colors, highest reproduction fidelity: `#FF0000` Red · `#00FF00` Green · `#0000FF` Blue · `#FFFF00` Yellow · `#00FFFF` Cyan · `#FF00FF` Magenta

---

## 8. API contract (base spec §5, with D3–D5 applied)

All under `/v1`; JSON by default.

- **`GET /v1/neighborhoods/:id`** — public read. Full JSON (shape per base spec §5.1: `id`, `name`, `timezone`, `rotation_hour`, `color{hex,rgb,hsl,name}`, `rotated_at`, `next_rotation_at`, `seconds_until_rotation`, `palette`, `day_index`). Headers `Cache-Control: public, max-age=<seconds_until_rotation>` + `ETag: "<id>-<day_index>"`; honor `If-None-Match` → `304`. `?format=hex` → `text/plain` `#RRGGBB`; `?format=rgb` → `text/plain` `r,g,b`. Unknown id → `404 { "error": "neighborhood_not_found" }`. `palette` field per D5.
- **`POST /v1/neighborhoods`** — create. Optional body `{ name?, timezone?, rotation_hour?, palette? }`. `201` returns config **plus** `admin_secret` (`nh_sk_…`, ≥32 bytes base64url) and `manage_url` (D4). `id` via `crypto.randomUUID()`.
- **`GET /v1/neighborhoods/:id/manage`** — full editable config (auth). Returns the same editable fields as `PATCH` accepts (`name`, `timezone`, `rotation_hour`, `palette`, `custom_colors`) plus `id`; it does **not** re-return `admin_secret` — the secret is shown exactly once, at create. *(D3)*
- **`PATCH /v1/neighborhoods/:id`** — update (auth). Subset of `name`, `timezone` (IANA-validated), `rotation_hour` (0–23), `palette` (slug or null), `custom_colors` (array of `{hex,name?}` `#RRGGBB`, or null). Returns updated config.
- **`DELETE /v1/neighborhoods/:id`** — delete (auth) → `204`.
- **`GET /v1/palettes`** — list active curated palettes (public).

**Auth:** `Authorization: Bearer <admin_secret>`; missing/blank → `401 unauthorized`; wrong secret for that id → `403 forbidden`; constant-time compare. **CORS:** public GETs `origin: '*'`; management routes restricted to `CORS_ORIGIN`. **Errors:** `{ "error": "<snake_case>", "message": "..." }`. The `color.rgb` array is a drop-in for Home Assistant `rgb_color:` and must never be removed.

---

## 9. Testing strategy

Pure `lib/*` unit tests go **green first** (base spec §8): determinism, even distribution over n-day windows, cross-neighborhood divergence, DST spring-forward/fall-back in `America/Chicago`, `day_index` +1/day across zones, `seconds_until_rotation` sign/consistency, hex→rgb/hsl spot checks (`#FF0000` → `[255,0,0]`/`[0,100,50]`), invalid-hex rejection.

Then `test/api.test.ts` runs against `@cloudflare/vitest-pool-workers` with migrations applied + all seven palettes seeded in setup: full response shape + cache headers, `304` on matching `If-None-Match`, `format=hex|rgb`, create returns unique ≥32-byte secret, `401`/`403`/success auth matrix, `400` on invalid timezone / hour / `custom_colors`, `GET /v1/palettes` lists the seeded palettes.

---

## 10. Deployment

Wrangler is installed and authorized (D9). Live steps run with a confirmation before each account-touching command:
1. `wrangler d1 create neighborhue` → capture `database_id` into `wrangler.toml`.
2. `drizzle-kit generate` → `wrangler d1 migrations apply neighborhue` (local, then remote on confirm).
3. `npm run seed` (local, then remote on confirm).
4. `wrangler deploy`.

Everything before deployment (scaffold, lib + tests, schema/migrations/seed, routes, API tests) runs fully locally against the Workers/D1 pool.

---

## 11. Build order

1. Scaffold Hono Cloudflare Workers project; add Drizzle, Zod, `@hono/zod-validator`, Luxon, Vitest + workers pool; `tsconfig` strict.
2. `lib/hash.ts`, `lib/pick.ts`, `lib/color.ts`, `lib/rotation.ts`, `lib/ids.ts` **with unit tests first — green before any DB work.**
3. `db/schema.ts`, `db/client.ts`, `drizzle.config.ts`, `wrangler.toml`; `d1 create`; generate + apply migrations; `seed/palettes.ts` (seven palettes).
4. Public read route (`GET /:id` + `format=` + caching/ETag/304).
5. Management routes (create/patch/delete/`:id/manage`) + `auth.ts` + `validators.ts`.
6. `GET /v1/palettes`.
7. Full `api.test.ts` against the Workers runtime; README with the Home Assistant REST-sensor example.
8. Live provisioning + `wrangler deploy` (with per-command confirmation).

---

## 12. Out of scope (v1)

User accounts / OAuth, stored daily colors, color history endpoints, webhooks, in-Worker rate limiting, the Next.js frontend, and the Home Assistant client package (separate repo). The Worker stays stateless apart from D1 config.
