# Monorepo Restructure — Design

**Date:** 2026-07-16
**Status:** Approved for planning
**Supersedes:** the "frontend is a separate repo" assumption recorded in [`docs/frontend-design-brief.md`](../../frontend-design-brief.md) (line 3) and the `Package manager: **npm**` line in [`2026-07-15-neighborhue-backend-design.md`](2026-07-15-neighborhue-backend-design.md) §2 (the project has since moved to pnpm + Biome).

Restructures the repository from a single-app layout into a pnpm workspace holding the existing API and a scaffolded frontend package, and establishes a compile-time-checked type contract between them.

**This change does not build the frontend.** A separate session owns the frontend design spec; `apps/web` here is a package boundary and a typed client, nothing more (§6).

---

## 1. Why

The backend is deployed and stable at `api.neighborhue.app`. The frontend is next, and the open question was one repo or two.

**One repo, because of the Hono RPC seam.** With `hc<AppType>`, the frontend's API calls derive their request and response types directly from the API's source. Rename a field in `src/validators.ts` and the *frontend* fails `tsc`. Across two repos that requires publishing a versioned types package and keeping it in sync — permanent overhead for a two-app project with one maintainer.

Everything else (atomic commits, one lockfile, one Biome config) is real but secondary. If the RPC seam were removed, the case for a monorepo here would be weak.

**Wrangler supports this natively — there is no "monorepo mode" to enable.** Wrangler is already per-config: each app owns a config file, and `wrangler deploy -c <path>` deploys exactly one Worker. Local multi-Worker dev is `wrangler dev -c a -c b` (first config is primary on `:8787`, rest are auxiliary). Workers Builds connects one repo to multiple Workers via per-Worker **root directory** + **build watch paths**, so a commit only rebuilds the Workers whose watch paths it touched.

---

## 2. Resolved decisions

| # | Decision | Resolution | Rationale |
|---|---|---|---|
| M1 | Repo strategy | **Monorepo**, pnpm workspace, single lockfile | The RPC type seam (§4). Secondary: shared `allowBuilds` / `minimumReleaseAgeExclude` policy stays in one place instead of drifting across two repos. |
| M2 | Directory layout | **`apps/api`, `apps/web`** | Leaves `packages/*` free for genuinely shared code later without a second reshuffle. |
| M3 | Shared code package | **None.** No `packages/shared` in this change. | YAGNI. `apps/web` depends on `@neighborhue/api` directly for types. Revisit only when non-type code is genuinely shared. |
| M4 | API config format | **`wrangler.toml` → `wrangler.jsonc`** | Cloudflare's current guidance; newer features are JSON-only; `$schema` gives editor autocomplete. Nothing in the current config is TOML-dependent. |
| M5 | Type sharing mechanism | `apps/api` exports `AppType`; `apps/web` consumes via `hc<AppType>` | The reason for M1. Requires the route chaining in §5. |
| M6 | Web stack | **Vite + React + Radix Primitives + Radix Colors** — *recorded as input to the frontend spec, not installed here (M14)* | Radix is React-only, which settles the framework. No SSR need — the color is deterministic and reads are public. |
| M7 | Radix Themes vs Primitives | **Primitives, not Themes** | Themes' `accentColor` takes predefined named scales; custom brand colors require a 12-step scale generated offline and pasted as static CSS. Neighborhue's accent is an arbitrary hex that changes daily and may be user-defined. Themes would fight the core hook (§6). |
| M8 | Next.js / OpenNext | **Rejected** | Requires the `@opennextjs/cloudflare` adapter for a runtime we don't need. No SSR requirement. Dynamic OG tags — the one real argument — are solvable with `run_worker_first` on the share route alone. |
| M9 | Web deploy target | Worker with static assets, `not_found_handling: "single-page-application"` — *recorded as input to the frontend spec, not configured here (M14)* | Client-side routes never invoke the Worker, so SPA routing costs nothing. |
| M10 | Biome | **One config at the repo root** | A single lint/format standard across both apps. Requires the glob fix in §3.2. |
| M11 | TypeScript config | `tsconfig.base.json` + per-app configs | Non-negotiable, not cosmetic: `apps/web` needs `lib: ["DOM"]` and **must not** inherit `@cloudflare/workers-types`. |
| M12 | `apps/web` scope | **Workspace scaffold only** — package boundary + typed client, no framework | A separate session owns the frontend spec. This change must not pre-empt it. Scaffold enough to prove the type seam (§7.5) and nothing more (§6). |
| M13 | Commit sequencing | **Move and RPC refactor are separate commits** | The RPC refactor re-indents ~170 lines and would otherwise swamp the file moves in review (§5). |
| M14 | Web framework install | **Deferred to the frontend spec.** No `react`, `radix`, `vite`, or `wrangler.jsonc` in `apps/web` in this change. | M6–M8 record the *reasoning* (React via Radix; Vite SPA; not Next.js) as input to that spec, but installing them here would create merge conflicts with the other session and bake in choices this change has no need to make. |
| M15 | `wrangler` placement | **Per-app devDependency, not hoisted to the root** | Resolves from each package's own `node_modules/.bin` with no reliance on pnpm's implicit root-bin PATH behavior, and lets the apps drift versions independently. Costs minor lockfile duplication. |

---

## 3. Target layout

```
neighborhue/
├── package.json            # private root — workspace scripts + Biome
├── pnpm-workspace.yaml     # + packages: ['apps/*']
├── pnpm-lock.yaml          # single lockfile
├── biome.json              # one config, whole repo
├── tsconfig.base.json      # shared strict options
├── README.md
├── docs/                   # unchanged location
└── apps/
    ├── api/
    │   ├── package.json    # @neighborhue/api
    │   ├── wrangler.jsonc  # converted from wrangler.toml (M4)
    │   ├── tsconfig.json   # extends ../../tsconfig.base.json
    │   ├── vitest.config.ts
    │   ├── drizzle.config.ts
    │   ├── migrations/  seed/  src/  test/
    └── web/                # scaffold only — frontend spec owns the rest (M12/M14)
        ├── package.json    # @neighborhue/web
        ├── tsconfig.json   # extends ../../tsconfig.base.json; DOM lib
        └── src/
            └── lib/client.ts   # hc<AppType>
```

### 3.1 What moves without edits

`src/`, `test/`, `seed/`, `migrations/` move wholesale into `apps/api/`.

**No import rewrites are needed.** Every test imports via relative paths (`../src/lib/color`, `../seed/palettes`), and the whole tree moves together, so all relative paths stay valid. Likewise these keep working because they resolve relative to files that move alongside them:

- `migrations_dir` in the Wrangler config
- `path.join(__dirname, 'migrations')` in `vitest.config.ts`
- `schema` / `out` in `drizzle.config.ts`
- `seed/seed.sql` paths in the seed scripts (which run with `apps/api` as cwd)

### 3.2 What actually changes

| File | Change |
|---|---|
| `biome.json` | `includes` currently holds `"!migrations"` and `"!seed/seed.sql"`, which are relative to the config file and would silently stop matching at the new depth. Becomes `"!**/migrations/**"` and `"!**/seed.sql"`. |
| `pnpm-workspace.yaml` | Add `packages: ['apps/*']`. Existing `allowBuilds` and `minimumReleaseAgeExclude` stay and continue to apply repo-wide. |
| `package.json` | Splits into root + `apps/api` (§3.3). |
| `tsconfig.json` | Splits into `tsconfig.base.json` + per-app configs (M11). |
| `wrangler.toml` | Converted to `wrangler.jsonc` (M4). `vitest.config.ts`'s `configPath: './wrangler.toml'` must be updated to match. |
| `src/index.ts`, `src/routes/*.ts` | RPC chaining (§5) — separate commit per M13. |

### 3.3 Dependency split

- **Root** — `@biomejs/biome`, `packageManager`, workspace proxy scripts (`pnpm -F @neighborhue/api dev`, `pnpm -r test`, `pnpm -r typecheck`). Biome runs from the root across the whole repo.
- **`apps/api`** — runtime: `hono`, `drizzle-orm`, `zod`, `luxon`, `@hono/zod-validator`. Dev: `wrangler`, `vitest`, `@cloudflare/vitest-pool-workers`, `@cloudflare/workers-types`, `drizzle-kit`, `tsx`, `@types/luxon`, `@types/node`, `typescript`.
- **`apps/web`** — runtime: `@neighborhue/api` (`workspace:*`), `hono` (for `hono/client`). Dev: `typescript`. **Nothing else** — see M14 / §6.2.

`wrangler` is declared **per-app, not hoisted** (M15): resolution comes from each package's own `node_modules/.bin` with no dependence on pnpm's root-bin PATH behavior, and the two apps can drift versions independently. In this change only `apps/api` declares it; `apps/web` picks it up when the frontend spec adds its Worker config.

> **Planning note:** `typescript` is likewise declared per-app rather than only at the root, so `tsc` resolves unambiguously from each package. The plan should verify whether a root declaration is additionally needed rather than assume it either way.

---

## 4. The type seam

`apps/api/package.json` exposes its source directly:

```jsonc
"exports": {
  ".":       { "types": "./src/index.ts", "default": "./src/index.ts" },
  "./types": { "types": "./src/types.ts", "default": "./src/types.ts" }
}
```

Exporting raw TypeScript with no build step is safe **because the import is type-only**:

```ts
import type { AppType } from '@neighborhue/api'   // erased at compile time
```

`import type` is erased by TypeScript, so no `.ts` from `apps/api` ever reaches Vite's dep optimizer or the web bundle. Only `tsc` resolves it.

> **Constraint (load-bearing):** `apps/web` imports **types only** from `@neighborhue/api`. Importing a runtime value would put untranspiled TypeScript into Vite's graph and require a build step for the API package. If runtime sharing is ever needed, that is the trigger to create `packages/shared` (M3) — not to relax this rule.

**Qualification — this is safe on the bundling axis, not the typechecking axis.** The argument above concerns erasure only. On typechecking, `apps/web`'s `tsc` walks `apps/api`'s entire import graph reachable from `AppType` and checks it under **`apps/web`'s own compiler options**, not `apps/api`'s. Because `apps/web/tsconfig.json` sets `"types": []` (M11), any ambient Cloudflare Workers global reachable from that graph must have a stub in `apps/web/src/global.d.ts` or the build fails with `Cannot find name 'X'`. Today that's exactly one global: `D1Database`, reached transitively through `types.ts` → `db/queries` → `db/client.ts`'s `getDb(d1: D1Database)` — not through `AppType`'s Hono generics.

The failure mode this produces is easy to misdiagnose: a `Cannot find name 'X'` error pointing at an `apps/api` file *looks* like the RPC contract broke, but it isn't a contract break — it means "add a stub for `X` in `apps/web/src/global.d.ts`." See §9 for the durable fix and why it's deferred.

---

## 5. RPC route chaining

Hono accumulates route types only through method chaining. From the Hono docs: *"For correct RPC route inference, all included methods must be chained, and the endpoint or app type must be inferred from a declared variable."*

The current code chains nothing:

```ts
export const neighborhoodsRoute = new Hono<AppEnv>()
neighborhoodsRoute.get('/:id', ...)      // type discarded
neighborhoodsRoute.post('/', ...)        // type discarded
```

Required shape:

```ts
// src/routes/neighborhoods.ts  — 5 routes chained
export const neighborhoodsRoute = new Hono<AppEnv>()
  .get('/:id', async (c) => { ... })
  .post('/', zJson(createSchema), async (c) => { ... })
  .get('/:id/manage', requireAdminSecret, async (c) => { ... })
  .patch('/:id', requireAdminSecret, zJson(patchSchema), async (c) => { ... })
  .delete('/:id', requireAdminSecret, async (c) => { ... })

// src/index.ts
const routes = app
  .route('/v1/neighborhoods', neighborhoodsRoute)
  .route('/v1/palettes', palettesRoute)

export type AppType = typeof routes
export default routes
```

**Scope, stated honestly:** this touches all 5 routes in `neighborhoods.ts` (~170 lines re-indented), the 1 route in `palettes.ts`, and `index.ts`. No control flow, handler bodies, or middleware order changes. The existing suite must stay green with **zero test edits**; any test change is a signal the refactor altered behavior and must be investigated, not accommodated.

**One structural wrinkle, not pure re-indentation:** `neighborhoods.ts` declares two helpers — `todaysColor` (between the `/:id` and `POST /` routes) and `serializeConfig` (between `POST /` and `/:id/manage`). A chain is a single expression, so both must move *above* it. They are `function` declarations and therefore hoisted, so this is behavior-preserving, but it is a real edit rather than whitespace.

**Known wart, accepted:** `GET /:id` returns `c.json`, `c.text` (for `?format=hex|rgb`), and `c.body(null, 304)`, so its inferred client type is a union across formats and status codes and will be awkward to consume. This does not block the refactor — the success criterion is that `AppType` exports and the suite stays green, not that every route has an ergonomic client type. Address the ergonomics when the frontend actually consumes that route.

Per M13 this lands as its own commit, after the move.

---

## 6. `apps/web` scope

> **Coordination:** a separate session owns the frontend design spec. This change establishes only the *package boundary* so that spec has a place to land. It deliberately installs no framework (M14).

### 6.1 In scope — the whole of it

```
apps/web/
├── package.json      # @neighborhue/web; deps: @neighborhue/api (workspace:*), hono
├── tsconfig.json     # extends ../../tsconfig.base.json; lib: ["DOM", "ES2022"]
└── src/
    └── lib/client.ts # hc<AppType> — the artifact being proven
```

`src/lib/client.ts` is framework-agnostic and roughly:

```ts
import { hc } from 'hono/client'
import type { AppType } from '@neighborhue/api'

export const createClient = (baseUrl: string) => hc<AppType>(baseUrl)
```

> **Deliberately takes `baseUrl` as a parameter rather than reading `import.meta.env.VITE_API_URL`.** `import.meta.env` is a Vite construct requiring `vite/client` types, which M14 defers — using it here would fail `pnpm -F @neighborhue/web typecheck` and break the very seam test it exists to enable. The frontend spec wires in config resolution when it adds Vite.

**Why this file exists at all, given "scaffold only":** §7.5 is the only check that proves the restructure achieved its purpose, and it requires something to import `AppType`. Without it, the workspace would be structurally valid but the seam unverified — the restructure could be silently broken and every other check would still pass. This is the minimum that makes the change falsifiable.

### 6.2 Explicitly deferred to the frontend spec

`react`, `react-dom`, `@radix-ui/*`, `vite`, `@vitejs/plugin-react`, `@cloudflare/vite-plugin`, `wrangler`, `index.html`, `vite.config.ts`, and `wrangler.jsonc` — plus every screen, state, and visual decision in [`docs/frontend-design-brief.md`](../../frontend-design-brief.md).

M6–M8 are **recorded reasoning, not commitments made here**, and should be treated as input to that spec:

- **Radix is React-only** — choosing Radix settles the framework question.
- **Radix Primitives over Themes (M7)** — Themes' `accentColor` takes predefined scales; a custom brand color needs a 12-step scale generated offline and pasted as static CSS. Neighborhue's accent is arbitrary hex, changes daily, and may be user-defined, so Themes fights the core hook. Use Radix Colors for the *stable* chrome (grays, light/dark) and a CSS custom property for the daily hue, with a WCAG-AA foreground derived at runtime from the API's `color: {hex, rgb, hsl, name}`. `apps/api/src/lib/color.ts` already owns that math.
- **Next.js/OpenNext rejected (M8)** — no SSR need. The one real counter-argument is per-neighborhood OG meta tags, since the share page is the hero and gets pasted into group chats. That's reachable with `run_worker_first: ["/n/*"]` on the share route alone, letting the Worker inject OG tags while everything else stays static. Recorded here so the reasoning isn't relitigated.

### 6.3 Known conflict risk

If the other session's frontend spec assumes a **separate repo** (as [`docs/frontend-design-brief.md`](../../frontend-design-brief.md) line 3 still says) or a different directory layout, the two specs disagree and this one is newer. Reconcile before implementing the frontend — see §8.

---

## 7. Verification

1. `pnpm install` resolves the workspace; `@neighborhue/api` symlinks into `apps/web/node_modules`.
2. `pnpm -r typecheck` and `pnpm -r test` pass — **the existing API suite green and unmodified**.
3. `pnpm check` (Biome) passes from the root across both apps, and still ignores `migrations/` and `seed.sql`.
4. `wrangler deploy --dry-run -c apps/api/wrangler.jsonc` succeeds, confirming the TOML→JSONC conversion preserved the D1 binding, custom domain route, and vars.
5. **The seam test — the only proof the monorepo earns its keep:** rename the `palettes` response key to `paletteList` in `apps/api/src/routes/palettes.ts` and confirm `pnpm -F @neighborhue/web typecheck` **fails**. Revert. If this *passes*, the RPC wiring is broken regardless of what else is green.

   > Targets `routes/palettes.ts`, **not** `validators.ts` — the latter holds *request* schemas, so renaming there would not perturb a response type. `/v1/palettes` is also the only route with a single clean `c.json` response; `/v1/neighborhoods/:id` mixes `c.json`, `c.text` (for `?format=hex|rgb`), and `c.body(null, 304)`, so its inferred client type is an awkward union — see §5.

No API behavior changes in this work. A green existing suite is therefore meaningful signal, not a formality — and per §5 any test edit is a red flag to investigate, not accommodate.

**Not verifiable in this change:** multi-Worker dev (`wrangler dev -c apps/web/… -c apps/api/…`) needs `apps/web` to have a Worker config, which M14 defers. The API's own `wrangler dev` still works. Multi-Worker dev becomes verifiable once the frontend spec lands its config.

---

## 8. Docs to update

Part of this change, not follow-up:

- `docs/frontend-design-brief.md:3` — "The frontend is a **separate repo**" is now false. **Coordinate before editing:** the other session may be actively working from this brief. Keep the edit to the single stale claim — do not restructure the brief, since it is that session's input.
- `README.md` — root-level commands (`pnpm run seed`, `wrangler deploy`, `pnpm test`) all move under `apps/api`.
- `2026-07-15-neighborhue-backend-design.md` §2 — `Package manager: **npm**` is stale (project now uses pnpm + Biome). Correct in place or annotate as superseded.

---

## 9. Out of scope

- **The frontend, entirely** — framework install, build tooling, Worker config, and every screen in the design brief. Owned by the frontend spec (M12/M14, §6.2).
- `packages/shared` (M3).
- Workers Builds / CI setup. Deploys stay manual via Wrangler; no CI exists in the repo today. Root directory + build watch paths are the mechanism if that changes.
- Any change to API behavior, routes, schema, or the deployed `api.neighborhue.app` Worker. It is live but unannounced (testing only), so no migration or compatibility story is needed — but the Worker must keep deploying to the same name (`neighborhue-api`) and domain.
- OG tag injection via `run_worker_first` (§6.2, deferred).
- **Follow-up: have `apps/api` emit `.d.ts`.** This is the durable fix for the stub-maintenance burden described in §4 — replaces "typecheck `apps/api`'s raw source" with "typecheck a generated declaration file," so `apps/web` no longer needs to mirror `apps/api`'s ambient globals in `global.d.ts`.

  | | |
  |---|---|
  | Already in place | `skipLibCheck: true` is already set in `tsconfig.base.json` and inherited by `apps/web` — half of what emitting `.d.ts` needs is done. Remaining work is the emit itself plus **build-ordering guarantees** (`apps/web` typecheck must not run against a missing or stale `apps/api` build). |
  | Why deferring is correct, not lazy | Doing this today would be a net regression: a stale `dist/` would let `apps/web` typecheck cleanly against **yesterday's** contract — the seam would *pass when it should fail*, silently. That's the exact failure class the monorepo restructure exists to prevent (§1). Raw `.ts`, by contrast, can never be stale — it's read live on every typecheck. |
  | Why the trigger hasn't fired | The stub problem only grows if `apps/api` gains bindings beyond D1 (`KVNamespace`, `R2Bucket`, `Queue`, `DurableObjectNamespace`, ...). Decision **D6** in [`2026-07-15-neighborhue-backend-design.md`](2026-07-15-neighborhue-backend-design.md) makes the Worker stateless apart from D1 config a hard constraint — in-Worker rate limiting is an explicit non-goal — so a new binding is not imminent. |
  | Do it when | Either the API gains a non-D1 binding, or the frontend lands its build pipeline (whichever comes first). The latter is the natural trigger because that's when Vite and a real task runner arrive, making it cheap to sequence the emit correctly instead of bolting on ad hoc ordering now. |
  | The DOM-vs-Worker `Response` divergence (§4/M11) does not compound this | Established during review: it has zero surface in current code and cannot corrupt the contract types. Payload types in `AppType` come from Hono's `TypedResponse._data`, computed from the object literals passed to `c.json(...)` — global `Response` never contributes to them. So the seam fails loudly (a name-lookup error) or not at all; it cannot silently mislead. |
