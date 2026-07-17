// apps/api exports `AppType` from raw .ts source (no build step — see
// apps/web/src/lib/client.ts). Because it is raw source rather than a
// pre-built .d.ts, TypeScript checks it under *this* package's compiler
// options, not apps/api's. `AppEnv.Bindings.DB` is typed as the ambient
// `D1Database` global from `@cloudflare/workers-types`, which threads
// through Hono's generics into `AppType`.
//
// We deliberately do NOT add `@cloudflare/workers-types` as a dependency
// here (see apps/web/tsconfig.json's `types: []`): that package redeclares
// `Request`/`Response`/`fetch` with Worker-flavored types that conflict
// with the `DOM` lib this browser app needs, and it would leak the rest of
// the Workers global surface into an app that never runs in a Worker.
//
// Nothing in this package reads the DB binding's shape — only response
// bodies are consumed via `hc<AppType>()` — so an empty structural stub is
// enough to satisfy the name lookup without pulling in real Worker types.
//
// Maintenance contract: this file stubs every ambient Workers global
// reachable from apps/api's *import graph*, not just ones apps/web uses.
// `D1Database` above is reached transitively (types.ts -> db/queries ->
// db/client.ts's `getDb(d1: D1Database)`), not through AppType's generics.
// If apps/api adds a binding like `KVNamespace`, `R2Bucket`, `Queue`, or
// `DurableObjectNamespace`, apps/web's typecheck will fail with
// `Cannot find name 'X'` pointing at an apps/api file. That looks exactly
// like an API-contract break from this side — it isn't one. It means
// "add a stub for X here."
//
// The stub is deliberately a name-satisfier, not a model of the real type:
// the actual `D1Database` is a `declare abstract class` with methods
// (prepare, batch, exec, withSession), while this is an empty interface.
// That's intentional — an empty interface merges cleanly into the real
// class if `@cloudflare/workers-types` is ever added here — so nothing in
// apps/web should ever rely on `D1Database`'s shape.
//
// Root cause: apps/api ships raw .ts with no build step, so its ambient
// globals leak into whatever type-checks it. Emitting a `.d.ts` from
// apps/api (with `skipLibCheck` here) would remove this whole class of
// problem; that tradeoff is being escalated to the restructure spec owner
// rather than decided in this file.
declare global {
  interface D1Database {}
}

export {}
