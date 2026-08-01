// Public, non-secret. VITE_API_URL is an optional local override (e.g. to point
// at a local `wrangler dev` API); apps/web/.env is gitignored, so the fallback
// is what production builds use.
export const API_URL = import.meta.env.VITE_API_URL ?? 'https://api.neighborhue.app'

// The neighborhood the Home hero reads to show a real, live daily color, and
// the target of both "live example" links. Public by nature — it is a share URL
// printed on the page for anyone to open — so the production id is committed
// rather than kept in a gitignored .env.
//
// That matters because VITE_* is inlined at BUILD time, not read at runtime:
// it cannot come from a Worker binding or `wrangler secret`, and a build on a
// machine without the .env would silently ship the fallback card with no error
// to notice. The override still works for pointing dev at a local API's row.
//
// A missing/deleted row is still a supported state: the hero falls back to a
// static example and withholds both links rather than rendering them broken.
// Setting the var to an EMPTY string is how you turn the live example off —
// otherwise, with a committed default, there would be no way to exercise the
// fallback path locally.
const demoOverride = import.meta.env.VITE_DEMO_NEIGHBORHOOD_ID?.trim()
export const DEMO_NEIGHBORHOOD_ID: string | null =
  demoOverride === undefined ? '6e2cd395-4d85-4ee5-9eca-f4739b4b68c1' : demoOverride || null
