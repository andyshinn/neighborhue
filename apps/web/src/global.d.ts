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
declare global {
  interface D1Database {}
}

export {}
