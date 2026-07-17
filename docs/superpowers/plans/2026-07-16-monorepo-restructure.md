# Monorepo Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert this single-app repo into a pnpm workspace with the existing Worker at `apps/api` and a scaffolded `apps/web`, joined by a compile-time-checked Hono RPC type contract.

**Architecture:** `src/`, `test/`, `seed/`, `migrations/` and their configs move wholesale into `apps/api/` — because every test imports via relative paths and the tree moves together, **no import rewrites are needed**. The root keeps the pnpm workspace, one Biome config, and a shared `tsconfig.base.json`. `apps/api` exports its Hono `AppType`; `apps/web` imports it type-only via `hc<AppType>`, so an API contract change fails the web typecheck.

**Tech Stack:** pnpm workspaces · TypeScript · Hono (+ `hono/client` RPC) · Cloudflare Workers · Wrangler · D1 · Drizzle · Vitest + `@cloudflare/vitest-pool-workers` · Biome

**Spec:** [`docs/superpowers/specs/2026-07-16-monorepo-restructure-design.md`](../specs/2026-07-16-monorepo-restructure-design.md)

## Global Constraints

- **This is a refactor. No API behavior changes.** Routes, schema, and responses are byte-identical. The deployed Worker must keep the name `neighborhue-api` and the domain `api.neighborhue.app`.
- **Zero test edits.** The existing suite must pass unmodified at every task boundary. A test that needs changing is a signal the refactor broke something — investigate, do not accommodate.
- **`apps/web` installs no framework.** No `react`, `@radix-ui/*`, `vite`, `@vitejs/plugin-react`, `@cloudflare/vite-plugin`, `wrangler`, `index.html`, `vite.config.ts`, or `wrangler.jsonc`. A separate session owns the frontend spec (spec M12/M14).
- **`apps/web` imports types only** from `@neighborhue/api`. A runtime import would drag untranspiled TypeScript into the web build and force a build step for the API package (spec §4).
- **No `import.meta.env` in `apps/web`.** It is a Vite construct needing `vite/client` types, which are deliberately absent — it would fail the web typecheck.
- **`wrangler` and `typescript` are per-app devDependencies**, not hoisted to the root (spec M15).
- Package names: root `neighborhue` (private), `@neighborhue/api`, `@neighborhue/web`.
- Do not touch `.gitignore` — it has uncommitted user edits.
- The API is live but unannounced (testing only), so no migration or compatibility story is needed.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `pnpm-workspace.yaml` | Workspace globs + existing build/release policy | 1 |
| `package.json` (root) | Private root: Biome + proxy scripts only | 1 |
| `tsconfig.base.json` | Compiler options shared by every app | 1 |
| `apps/api/package.json` | API deps + all Worker/DB scripts | 1 |
| `apps/api/tsconfig.json` | Workers-specific types; extends base | 1 |
| `biome.json` | One lint/format config; globs fixed for new depth | 1 |
| `README.md` | Commands now live under `apps/api` | 1 |
| `apps/api/wrangler.jsonc` | Worker config, converted from TOML | 2 |
| `apps/api/vitest.config.ts` | Points at the renamed config | 2 |
| `apps/api/src/routes/palettes.ts` | Chained for RPC inference | 3 |
| `apps/api/src/routes/neighborhoods.ts` | Chained; helpers hoisted above the chain | 3 |
| `apps/api/src/index.ts` | Chains sub-routers; exports `AppType` | 3 |
| `apps/web/package.json` | Web package boundary; `@neighborhue/api` workspace dep | 4 |
| `apps/web/tsconfig.json` | DOM lib, `types: []` to exclude Workers types | 4 |
| `apps/web/src/lib/client.ts` | `hc<AppType>` client — the artifact being proven | 4 |
| `docs/frontend-design-brief.md` | Stale "separate repo" claim corrected | 5 |
| `docs/superpowers/specs/2026-07-15-neighborhue-backend-design.md` | Stale "npm" claim corrected | 5 |

**Task order is load-bearing.** Task 1 moves files; Task 2 needs them moved; Task 3 needs a green suite to refactor against; Task 4 needs `AppType` from Task 3.

---

### Task 1: pnpm workspace + move the API to `apps/api`

**Files:**
- Move: `src/`, `test/`, `seed/`, `migrations/`, `wrangler.toml`, `vitest.config.ts`, `drizzle.config.ts` → `apps/api/`
- Rename: `tsconfig.json` → `tsconfig.base.json`
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`
- Modify: `package.json`, `pnpm-workspace.yaml`, `biome.json`, `README.md`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: workspace packages `@neighborhue/api` (at `apps/api`) and root `neighborhue`. Root scripts `pnpm test`, `pnpm typecheck`, `pnpm check`. `tsconfig.base.json` for later apps to extend.

- [ ] **Step 1: Record the green baseline**

Run: `pnpm test 2>&1 | tail -5`

Write down the exact passing test count. Every later task must match it. Expected: all tests pass (roughly 73 — record the real number, do not trust this one).

- [ ] **Step 2: Move the tree with `git mv`**

`git mv` preserves rename detection, keeping the diff reviewable.

```bash
mkdir -p apps/api
git mv src apps/api/src
git mv test apps/api/test
git mv seed apps/api/seed
git mv migrations apps/api/migrations
git mv wrangler.toml apps/api/wrangler.toml
git mv vitest.config.ts apps/api/vitest.config.ts
git mv drizzle.config.ts apps/api/drizzle.config.ts
git mv tsconfig.json tsconfig.base.json
```

- [ ] **Step 3: Confirm nothing else referenced the old paths**

Run: `grep -rn "\./src/\|\./seed/\|\./test/\|\./migrations" --include="*.json" --include="*.ts" --include="*.yaml" . | grep -v node_modules | grep -v "^./apps/"`

Expected: no output. If anything appears outside `apps/`, it needs its path updated — investigate before continuing.

- [ ] **Step 4: Add workspace globs to `pnpm-workspace.yaml`**

Keep every existing key — `allowBuilds` and `minimumReleaseAgeExclude` stay at the root and continue to apply repo-wide. Add `packages` at the top:

```yaml
packages:
  - 'apps/*'

# Native build scripts pnpm is allowed to run during install.
# esbuild + workerd are required by wrangler and the vitest Workers pool.
# sharp is a transitive wrangler dep used only for image features this
# stateless JSON worker never touches, so its native build is skipped.
allowBuilds:
  esbuild: true
  sharp: false
  workerd: true
# Cloudflare publishes workers-types daily; this pins the version pnpm's
# release-age gate flagged as too new so installs stay reproducible.
minimumReleaseAgeExclude:
  - '@cloudflare/workers-types@5.20260716.1'
```

- [ ] **Step 5: Rewrite the root `package.json`**

Drops the stale `main: index.js` and `directories.doc` cruft. Biome is the only root dependency.

```json
{
  "name": "neighborhue",
  "version": "1.0.0",
  "private": true,
  "description": "A neighborhood shares one color a day",
  "type": "module",
  "packageManager": "pnpm@11.13.0",
  "scripts": {
    "dev": "pnpm -F @neighborhue/api dev",
    "deploy": "pnpm -F @neighborhue/api deploy",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "format": "biome format --write .",
    "check": "biome check .",
    "check:fix": "biome check --write ."
  },
  "devDependencies": {
    "@biomejs/biome": "^2.5.4"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}
```

- [ ] **Step 6: Create `apps/api/package.json`**

The `exports` block is what lets `apps/web` import `AppType` in Task 4. Every script is carried over verbatim — they already use paths relative to this directory, so they work unchanged.

```json
{
  "name": "@neighborhue/api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": { "types": "./src/index.ts", "default": "./src/index.ts" },
    "./types": { "types": "./src/types.ts", "default": "./src/types.ts" }
  },
  "scripts": {
    "dev": "wrangler dev",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate:local": "wrangler d1 migrations apply neighborhue --local",
    "db:migrate:remote": "wrangler d1 migrations apply neighborhue --remote",
    "seed:build": "tsx seed/build-sql.ts",
    "seed:local": "pnpm run seed:build && wrangler d1 execute neighborhue --local --file=seed/seed.sql",
    "seed:remote": "pnpm run seed:build && wrangler d1 execute neighborhue --remote --file=seed/seed.sql",
    "seed": "pnpm run seed:remote",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "@hono/zod-validator": "^0.9.0",
    "drizzle-orm": "^0.45.2",
    "hono": "^4.12.30",
    "luxon": "^3.7.2",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.18.5",
    "@cloudflare/workers-types": "^5.20260716.1",
    "@types/luxon": "^3.7.2",
    "@types/node": "^26.1.1",
    "drizzle-kit": "^0.31.10",
    "tsx": "^4.23.1",
    "typescript": "^7.0.2",
    "vitest": "^4.1.10",
    "wrangler": "^4.111.0"
  }
}
```

- [ ] **Step 7: Reduce `tsconfig.base.json` to shared options only**

`lib` and `types` move out to the app configs — `apps/web` must not inherit `@cloudflare/workers-types`.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  }
}
```

- [ ] **Step 8: Create `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types", "@cloudflare/vitest-pool-workers/types"]
  },
  "include": ["src", "seed", "test", "*.ts"]
}
```

- [ ] **Step 9: Fix the Biome globs in `biome.json`**

`"!migrations"` and `"!seed/seed.sql"` are relative to this config file and would **silently stop matching** at the new depth — generated SQL would start getting linted. Change only the `files.includes` array; leave every other key alone.

```json
  "files": {
    "ignoreUnknown": false,
    "includes": ["**", "!**/migrations/**", "!**/seed.sql"]
  },
```

- [ ] **Step 10: Install and verify the workspace resolves**

Run: `pnpm install`
Expected: completes without error, and `apps/api/node_modules` now exists.

Run: `ls -d apps/api/node_modules/.bin/wrangler apps/api/node_modules/.bin/tsc`
Expected: both paths exist — confirms per-app binaries resolve without relying on root-bin PATH behavior.

- [ ] **Step 11: Verify the suite is green and unmodified**

Run: `pnpm test 2>&1 | tail -5`
Expected: identical passing count to Step 1.

Run: `pnpm typecheck`
Expected: no errors.

Run: `git status --short apps/api/test`
Expected: only `R` (rename) entries — **no `M`**. A modified test file means the move changed behavior. Stop and investigate.

- [ ] **Step 12: Verify Biome still ignores generated files**

Run: `pnpm check 2>&1 | tail -20`
Expected: passes. It must not report diagnostics for `apps/api/migrations/**` or `apps/api/seed/seed.sql`. If it does, Step 9's globs are wrong.

- [ ] **Step 13: Confirm `.gitignore` still covers the new depth**

Run: `git status --short | grep -E "node_modules|\.wrangler" || echo "correctly ignored"`
Expected: `correctly ignored`. Patterns like `node_modules/` match at any depth, but `wrangler dev` will now create `apps/api/.wrangler` — confirm it is not newly tracked. If it is, report it rather than editing `.gitignore` (it has uncommitted user edits).

- [ ] **Step 14: Update `README.md`**

Every documented root command now lives under `apps/api`. Update them to either the root proxies (`pnpm test`, `pnpm dev`, `pnpm deploy`) or the filtered form (`pnpm -F @neighborhue/api seed`). Add a short "Repository layout" section showing `apps/api` and `apps/web`. Do not rewrite unrelated prose.

- [ ] **Step 15: Commit**

```bash
git add -A ':!.gitignore'
git commit -m "refactor: move the API into apps/api as a pnpm workspace

Pure structural move. Every test imports via relative paths and the tree
moves together, so no imports changed and the suite is unmodified.

Splits package.json and tsconfig into root + per-app so apps/web can have
DOM types without inheriting @cloudflare/workers-types. Fixes the Biome
ignore globs, which were relative to the config file and would have
silently started linting generated SQL at the new depth."
```

---

### Task 2: Convert `wrangler.toml` to `wrangler.jsonc`

**Files:**
- Create: `apps/api/wrangler.jsonc`
- Delete: `apps/api/wrangler.toml`
- Modify: `apps/api/vitest.config.ts`

**Interfaces:**
- Consumes: `apps/api` package layout from Task 1
- Produces: `apps/api/wrangler.jsonc` — the config path every later `wrangler` invocation and the Vitest pool refer to

- [ ] **Step 1: Create `apps/api/wrangler.jsonc`**

Semantically identical to the TOML. The `database_id`, worker `name`, and custom domain must carry over **exactly** — this Worker is live.

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "neighborhue-api",
  "main": "src/index.ts",
  "compatibility_date": "2025-01-01",

  // API custom domain (apex neighborhue.app is reserved for the frontend SPA).
  // Cloudflare provisions the DNS record + SSL cert on deploy.
  "routes": [{ "pattern": "api.neighborhue.app", "custom_domain": true }],

  "vars": {
    "CORS_ORIGIN": "https://neighborhue.app",
    "MANAGE_URL_BASE": "https://neighborhue.app"
  },

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "neighborhue",
      "database_id": "f8d6f3f8-4ec1-40cc-99d6-fb2d30e6f1b6",
      "migrations_dir": "migrations"
    }
  ]
}
```

- [ ] **Step 2: Point the Vitest pool at the new filename**

In `apps/api/vitest.config.ts`, inside the `cloudflareTest` factory, change only this line:

```ts
        wrangler: { configPath: './wrangler.jsonc' },
```

Leave the long explanatory comment block at the top of that file intact — it documents non-obvious `@cloudflare/vitest-pool-workers` API drift and is still accurate.

- [ ] **Step 3: Delete the TOML**

```bash
git rm apps/api/wrangler.toml
```

- [ ] **Step 4: Verify the config still resolves and the suite passes**

Run: `pnpm test 2>&1 | tail -5`
Expected: same passing count as Task 1. This exercises the new config path — the pool reads `wrangler.jsonc` to build bindings, so a broken conversion fails loudly here.

- [ ] **Step 5: Verify the deploy config is valid without deploying**

Run: `pnpm -F @neighborhue/api exec wrangler deploy --dry-run 2>&1 | tail -20`
Expected: succeeds. Confirm the output names the `DB` D1 binding and the `api.neighborhue.app` custom domain. **Do not run a real deploy.**

- [ ] **Step 6: Commit**

```bash
git add apps/api/wrangler.jsonc apps/api/vitest.config.ts
git add -u apps/api
git commit -m "refactor: convert the API's wrangler config to jsonc

Cloudflare's current guidance prefers JSONC and newer features land there
first. Semantically identical: same worker name, D1 binding, database_id,
custom domain, and vars. Verified with wrangler deploy --dry-run."
```

---

### Task 3: Chain Hono routes and export `AppType`

**Files:**
- Modify: `apps/api/src/routes/palettes.ts`, `apps/api/src/routes/neighborhoods.ts`, `apps/api/src/index.ts`

**Interfaces:**
- Consumes: the moved API from Task 1
- Produces: `export type AppType` from `apps/api/src/index.ts` — Task 4's `hc<AppType>` depends on this exact name

**Why:** Hono accumulates route types only through method chaining. Per the Hono docs: *"For correct RPC route inference, all included methods must be chained, and the endpoint or app type must be inferred from a declared variable."* The current statement style discards every route's type, so `hc<AppType>` would infer nothing.

- [ ] **Step 1: Chain `palettes.ts` (the simple case first)**

One route. Replace the `export const` + separate `.get()` statement with a single chained expression:

```ts
// src/routes/palettes.ts
import { Hono } from 'hono'
import { getDb } from '../db/client'
import { getPaletteColors, listActivePalettes } from '../db/queries'
import type { AppEnv } from '../types'

export const palettesRoute = new Hono<AppEnv>().get('/', async (c) => {
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

- [ ] **Step 2: Run the tests**

Run: `pnpm test 2>&1 | tail -5`
Expected: same passing count. Chaining is behavior-preserving; a failure here means something else broke.

- [ ] **Step 3: Restructure `neighborhoods.ts`**

Two changes, in order:

**(a) Hoist the helpers above the chain.** `todaysColor` (currently between `GET /:id` and `POST /`) and `serializeConfig` (currently between `POST /` and `GET /:id/manage`) must move *above* the chained expression — a chain is one expression and cannot have statements interleaved. Both are `function` declarations, so this is behavior-preserving. Move them verbatim, keeping their comments.

**(b) Chain all five routes** in their existing order, preserving every handler body, middleware argument, and comment exactly:

```ts
export const neighborhoodsRoute = new Hono<AppEnv>()
  .get('/:id', async (c) => {
    /* body unchanged */
  })
  // Create
  .post('/', zJson(createSchema), async (c) => {
    /* body unchanged */
  })
  // Manage (full editable config; never returns the secret)
  .get('/:id/manage', requireAdminSecret, async (c) => {
    /* body unchanged */
  })
  // Update
  .patch('/:id', requireAdminSecret, zJson(patchSchema), async (c) => {
    /* body unchanged */
  })
  // Delete
  .delete('/:id', requireAdminSecret, async (c) => {
    /* body unchanged */
  })
```

**Route order must not change** — `/:id` is registered before `/:id/manage`, and Hono matches in registration order. Reordering would change routing behavior.

- [ ] **Step 4: Verify the re-indent changed no logic**

Run: `git diff -w apps/api/src/routes/neighborhoods.ts`

`-w` ignores whitespace, so a correct chaining refactor shows only structural lines: the `.get(`/`.post(` registration syntax, the closing `})` → `})`, and the two moved helpers. **Any changed line inside a handler body is a bug** — you altered logic while re-indenting. Revert that hunk.

Run: `pnpm test 2>&1 | tail -5`
Expected: same passing count. If a test fails, diff against `git show HEAD:apps/api/src/routes/neighborhoods.ts` rather than editing the test.

- [ ] **Step 5: Chain `index.ts` and export `AppType`**

The CORS middleware, `notFound`, and `onError` stay exactly as they are — only the two `.route()` statements become a chained expression assigned to a variable. `routes` and `app` are the same object at runtime, so `export default routes` is behavior-identical.

```ts
app.route('/v1/neighborhoods', neighborhoodsRoute)
app.route('/v1/palettes', palettesRoute)
```

becomes:

```ts
const routes = app.route('/v1/neighborhoods', neighborhoodsRoute).route('/v1/palettes', palettesRoute)

export type AppType = typeof routes
```

and the final line changes from `export default app` to:

```ts
export default routes
```

- [ ] **Step 6: Prove `AppType` actually carries route information**

A chained-but-empty `AppType` is the exact failure mode this task exists to prevent, and the test suite cannot catch it — the API behaves identically either way. Probe it directly.

Write `apps/api/appt-probe.ts` (paths are relative to that file's own location; `apps/api/tsconfig.json` already includes `*.ts` at the package root, so `tsc` picks it up):

```ts
import { hc } from 'hono/client'
import type { AppType } from './src/index'

const c = hc<AppType>('http://x')
// If AppType carries route information, `.v1.palettes.$get` exists and this compiles.
export const probe = c.v1.palettes.$get
```

Run: `pnpm -F @neighborhue/api exec tsc --noEmit`
Expected: **no error**. An error like "Property 'v1' does not exist" means the chaining did not take — fix it before Task 4, where the same failure would be much harder to diagnose.

Then remove the probe:

```bash
rm apps/api/appt-probe.ts
```

- [ ] **Step 7: Full verification**

Run: `pnpm test 2>&1 | tail -5` — same passing count.
Run: `pnpm typecheck` — no errors.
Run: `pnpm check` — passes.
Run: `git status --short apps/api/test` — **empty**. Zero test edits.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src
git commit -m "refactor: chain Hono routes to enable RPC type inference

Hono accumulates route types only through method chaining; the previous
statement style discarded them, so hc<AppType> would infer nothing.

Chains all 5 routes in neighborhoods.ts, 1 in palettes.ts, and the two
sub-router mounts in index.ts, which now exports AppType. The todaysColor
and serializeConfig helpers move above the chain since a chain is a single
expression — both are hoisted function declarations, so this is
behavior-preserving. Route registration order is unchanged.

No handler bodies or middleware changed. Suite green, zero test edits."
```

---

### Task 4: Scaffold `apps/web` and prove the type seam

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/src/lib/client.ts`

**Interfaces:**
- Consumes: `AppType` from `apps/api/src/index.ts` (Task 3)
- Produces: `createClient(baseUrl: string)` and `fetchPalettes(baseUrl: string)` from `apps/web/src/lib/client.ts`

**Scope:** package boundary and typed client only. No framework — see Global Constraints.

- [ ] **Step 1: Create `apps/web/package.json`**

`hono` is a real runtime dependency here (for `hono/client`), unlike `@neighborhue/api`, which is type-only and erased at compile time.

```json
{
  "name": "@neighborhue/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@neighborhue/api": "workspace:*",
    "hono": "^4.12.30"
  },
  "devDependencies": {
    "typescript": "^7.0.2"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

`"types": []` is deliberate and load-bearing: it stops TypeScript auto-including every `@types/*` package it can find, which is what would otherwise leak `@cloudflare/workers-types` into the browser app and let Worker globals typecheck here.

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM"],
    "types": [],
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `apps/web/src/lib/client.ts`**

`fetchPalettes` is not decoration — it is what makes the seam test meaningful. `createClient` alone never *reads* a response field, so renaming one in the API would not fail the typecheck and Step 6 would silently pass. The `data.palettes` access is the actual probe.

`/v1/palettes` is the target because it is the only route with a single clean `c.json` response. `/v1/neighborhoods/:id` mixes `c.json`, `c.text` (for `?format=hex|rgb`), and `c.body(null, 304)`, so its client type is an awkward union.

```ts
import type { AppType } from '@neighborhue/api'
import { hc } from 'hono/client'

/**
 * Typed API client. Takes an explicit baseUrl rather than reading
 * import.meta.env — that is a Vite construct, and Vite is deliberately not
 * installed here yet (see the monorepo restructure spec, M14).
 */
export const createClient = (baseUrl: string) => hc<AppType>(baseUrl)

/**
 * Exists to exercise the API type contract at compile time: the `data.palettes`
 * access below is what fails typecheck if the API renames that response key.
 */
export async function fetchPalettes(baseUrl: string) {
  const res = await createClient(baseUrl).v1.palettes.$get()
  if (!res.ok) throw new Error(`Failed to fetch palettes: ${res.status}`)
  const data = await res.json()
  return data.palettes
}
```

> **If the `.v1.palettes.$get()` accessor does not compile:** hc maps path segments to properties, so `app.route('/v1/palettes', …)` + `.get('/')` should yield `client.v1.palettes.$get()`. If the shape differs in this Hono version, fetch the current RPC docs via Context7 (`/websites/hono_dev`, query "hc client path accessor for mounted sub-router") and correct the accessor. Do **not** work around it by loosening types or casting to `any` — that would silently void the seam.

- [ ] **Step 4: Install and verify the workspace link**

Run: `pnpm install`

Run: `ls -l apps/web/node_modules/@neighborhue/`
Expected: `api` is a symlink into `apps/api` — this is the workspace resolution the whole design depends on.

- [ ] **Step 5: Verify the web app typechecks**

Run: `pnpm -F @neighborhue/web typecheck`
Expected: no errors. This proves `AppType` resolves across the package boundary and `data.palettes` is a real, known field.

- [ ] **Step 6: THE SEAM TEST — prove the contract is actually enforced**

This is the only check that proves the monorepo earned its keep. It is a **negative** test: the typecheck must FAIL.

Temporarily rename the response key in `apps/api/src/routes/palettes.ts` — change `return c.json({ palettes })` to:

```ts
  return c.json({ paletteList: palettes })
```

Run: `pnpm -F @neighborhue/web typecheck`
Expected: **FAILS**, with an error on `data.palettes` in `apps/web/src/lib/client.ts` (roughly "Property 'palettes' does not exist"). The error must point at the **web** file — that is the whole point: an API change broke the frontend at compile time.

> If this **passes**, the seam is broken. The likely causes, in order: `AppType` is not chained (Task 3 Step 6 should have caught it), the `exports` map in `apps/api/package.json` is wrong, or `fetchPalettes` is not actually reading a typed field. Fix the cause — do not proceed.

- [ ] **Step 7: Revert the deliberate break**

```bash
git checkout apps/api/src/routes/palettes.ts
```

Run: `pnpm -F @neighborhue/web typecheck`
Expected: passes again.

Run: `git status --short apps/api`
Expected: empty — confirms the break is fully reverted and nothing from Step 6 leaks into the commit.

- [ ] **Step 8: Full verification**

Run: `pnpm test 2>&1 | tail -5` — same passing count as Task 1 Step 1.
Run: `pnpm typecheck` — both apps clean.
Run: `pnpm check` — passes.

- [ ] **Step 9: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat: scaffold apps/web with a typed API client

Package boundary and hc<AppType> client only — no framework. A separate
session owns the frontend spec.

fetchPalettes reads data.palettes deliberately: without a real field
access the type seam is unenforced and the contract test passes vacuously.
Verified by renaming the API's response key and confirming the web
typecheck fails, then reverting.

tsconfig sets types: [] so the browser app cannot inherit
@cloudflare/workers-types. The client takes an explicit baseUrl rather
than import.meta.env, which would need vite/client types."
```

---

### Task 5: Correct the stale docs

**Files:**
- Modify: `docs/frontend-design-brief.md`, `docs/superpowers/specs/2026-07-15-neighborhue-backend-design.md`

**Interfaces:**
- Consumes: nothing — documentation only
- Produces: nothing

- [ ] **Step 1: Fix the "separate repo" claim in the design brief**

`docs/frontend-design-brief.md` line 3 currently reads:

> Handoff brief for a design tool. The frontend is a **separate repo** and is out of
> scope for the backend v1.

Replace only the stale claim:

> Handoff brief for a design tool. The frontend lives at `apps/web` in this
> monorepo (see `docs/superpowers/specs/2026-07-16-monorepo-restructure-design.md`)
> and is out of scope for the backend v1.

**Coordinate before editing.** Another session may be actively working from this brief. Change only this one claim — do not restructure the document, reword the product sections, or touch the tuning knobs. If the file has changed since this plan was written, re-read it and adapt rather than pasting blindly.

- [ ] **Step 2: Fix the stale package manager claim**

In `docs/superpowers/specs/2026-07-15-neighborhue-backend-design.md` §2, the last line reads `Package manager: **npm**.` Change to:

```
Package manager: **pnpm** (migrated from npm on 2026-07-16, along with Biome for lint/format).
```

- [ ] **Step 3: Check for other stale references**

Run: `grep -rniE "separate repo|npm run|package-lock" docs/ README.md | grep -v node_modules`
Expected: no hits describing current state. Historical narration inside the older spec (describing what was true then) is fine to leave — only fix claims about how the project works *now*. Report anything ambiguous rather than guessing.

- [ ] **Step 4: Commit**

```bash
git add docs README.md
git commit -m "docs: correct stale separate-repo and npm references

The frontend is now apps/web in this monorepo, and the project moved to
pnpm + Biome on 2026-07-16."
```

---

## Final Verification

Run every check from spec §7 in one pass:

- [ ] `pnpm install` — workspace resolves, `@neighborhue/api` symlinked into `apps/web/node_modules`
- [ ] `pnpm test` — same passing count as Task 1 Step 1
- [ ] `pnpm typecheck` — both apps clean
- [ ] `pnpm check` — Biome passes, generated SQL and migrations still ignored
- [ ] `pnpm -F @neighborhue/api exec wrangler deploy --dry-run` — succeeds, names the D1 binding and custom domain
- [ ] `git log --oneline -5` — five commits, each independently reviewable
- [ ] `git diff --stat HEAD~5 -- apps/api/test` — renames only, **zero content changes**

**Not verifiable in this change:** multi-Worker dev (`wrangler dev -c apps/web/… -c apps/api/…`) needs a Worker config in `apps/web`, which M14 defers to the frontend spec. The API's own `pnpm dev` still works.

**Do not deploy.** The Worker is live. Deploying is a separate, explicitly-confirmed action.
