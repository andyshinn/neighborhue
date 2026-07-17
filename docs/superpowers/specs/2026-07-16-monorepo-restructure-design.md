# Monorepo Restructure — Design

**Date:** 2026-07-16
**Status:** Approved for planning
**Supersedes:** the "frontend is a separate repo" assumption recorded in [`docs/frontend-design-brief.md`](../../frontend-design-brief.md) (line 3) and the `Package manager: **npm**` line in [`2026-07-15-neighborhue-backend-design.md`](2026-07-15-neighborhue-backend-design.md) §2 (the project has since moved to pnpm + Biome).

Restructures the repository from a single-app layout into a pnpm workspace holding the existing API and a new frontend, and establishes a compile-time-checked type contract between them.

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
| M6 | Web stack | **Vite + React + Radix Primitives + Radix Colors** | Radix is React-only, which settles the framework. No SSR need — the color is deterministic and reads are public. |
| M7 | Radix Themes vs Primitives | **Primitives, not Themes** | Themes' `accentColor` takes predefined named scales; custom brand colors require a 12-step scale generated offline and pasted as static CSS. Neighborhue's accent is an arbitrary hex that changes daily and may be user-defined. Themes would fight the core hook (§6). |
| M8 | Next.js / OpenNext | **Rejected** | Requires the `@opennextjs/cloudflare` adapter for a runtime we don't need. No SSR requirement. Dynamic OG tags — the one real argument — are solvable with `run_worker_first` on the share route alone. |
| M9 | Web deploy target | Worker with static assets, `not_found_handling: "single-page-application"` | Client-side routes never invoke the Worker, so SPA routing costs nothing. |
| M10 | Biome | **One config at the repo root** | A single lint/format standard across both apps. Requires the glob fix in §3.2. |
| M11 | TypeScript config | `tsconfig.base.json` + per-app configs | Non-negotiable, not cosmetic: `apps/web` needs `lib: ["DOM"]` and **must not** inherit `@cloudflare/workers-types`. |
| M12 | `apps/web` scope | **Wiring stub only** | Proves the type seam end-to-end. The real frontend is its own design pass (§6). |
| M13 | Commit sequencing | **Move and RPC refactor are separate commits** | The RPC refactor re-indents ~170 lines and would otherwise swamp the file moves in review (§5). |

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
    └── web/
        ├── package.json    # @neighborhue/web
        ├── wrangler.jsonc  # assets + SPA mode
        ├── tsconfig.json
        ├── vite.config.ts
        ├── index.html
        └── src/
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
- **`apps/web`** — runtime: `@neighborhue/api` (`workspace:*`), `react`, `react-dom`, `hono` (for `hono/client`), `@radix-ui/*` primitives, `@radix-ui/colors`. Dev: `vite`, `@cloudflare/vite-plugin`, `@vitejs/plugin-react`, `wrangler`, `typescript`, `@types/react`, `@types/react-dom`.

> **Planning note:** `typescript` is declared per-app rather than only at the root, so `tsc` resolves from each package's own `node_modules/.bin` regardless of pnpm's root-bin PATH behavior. The plan should verify whether the root declaration is additionally needed rather than assume it.

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

**Scope, stated honestly:** this touches all 5 routes in `neighborhoods.ts` (~170 lines re-indented), the 1 route in `palettes.ts`, and `index.ts`. No control flow, handler bodies, or middleware order changes — it is re-indentation plus operator placement. The existing suite must stay green with **zero test edits**; any test change is a signal the refactor altered behavior and must be investigated, not accommodated.

Per M13 this lands as its own commit, after the move.

---

## 6. `apps/web` scope

A **wiring stub**, not the frontend:

- `hc<AppType>` client in `src/lib/client.ts` — the artifact being proven
- One screen rendering today's color for a neighborhood
- Enough Radix Primitives to confirm they're wired
- `wrangler.jsonc` with `assets.not_found_handling: "single-page-application"`

Explicitly **not** in scope: the four screens, visual direction, and states in [`docs/frontend-design-brief.md`](../../frontend-design-brief.md). That brief remains the input to a later design pass.

**Color architecture (decided now because it constrains M7):** Radix Colors supplies the *stable* chrome — grays, light/dark. The *daily* hue is a CSS custom property computed from the API's `color: {hex, rgb, hsl, name}` response, with a WCAG-AA foreground derived at runtime. `src/lib/color.ts` already owns this math; Radix Themes would duplicate and conflict with it.

**Deferred, recorded so it isn't lost:** the share page is the product's hero and is expected to be pasted into group chats, so per-neighborhood OG meta tags matter. The plan is `run_worker_first: ["/n/*"]` on the share route only, letting the Worker inject OG tags while everything else stays static. Not built in this change; it is the reason M8 rejects Next.js without cost.

---

## 7. Verification

1. `pnpm install` resolves the workspace; `@neighborhue/api` symlinks into `apps/web/node_modules`.
2. `pnpm -r typecheck` and `pnpm -r test` pass — **the existing API suite green and unmodified**.
3. `pnpm check` (Biome) passes from the root across both apps, and still ignores `migrations/` and `seed.sql`.
4. `wrangler deploy --dry-run -c apps/api/wrangler.jsonc` succeeds, confirming the TOML→JSONC conversion.
5. `wrangler dev -c apps/web/wrangler.jsonc -c apps/api/wrangler.jsonc` starts both Workers.
6. **The seam test — the only proof the monorepo earns its keep:** rename a response field in `apps/api/src/validators.ts` and confirm `pnpm -F @neighborhue/web typecheck` **fails**. Revert. If this passes, the RPC wiring is broken regardless of what else is green.

No API behavior changes in this work. A green existing suite is therefore meaningful signal, not a formality.

---

## 8. Docs to update

Part of this change, not follow-up:

- `docs/frontend-design-brief.md:3` — "The frontend is a **separate repo**" is now false.
- `README.md` — root-level commands (`pnpm run seed`, `wrangler deploy`, `pnpm test`) all move under `apps/api`.
- `2026-07-15-neighborhue-backend-design.md` §2 — `Package manager: **npm**` is stale (project now uses pnpm + Biome). Correct in place or annotate as superseded.

---

## 9. Out of scope

- The real frontend build (the four screens in the design brief).
- `packages/shared` (M3).
- Workers Builds / CI setup. Deploys stay manual via Wrangler; no CI exists in the repo today. Root directory + build watch paths are the mechanism if that changes.
- Any change to API behavior, routes, schema, or the deployed `api.neighborhue.app` Worker.
- OG tag injection via `run_worker_first` (§6, deferred).
