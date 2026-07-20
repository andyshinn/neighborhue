// Public, non-secret. VITE_API_URL is an optional local override (e.g. to point
// at a local `wrangler dev` API); apps/web/.env is gitignored, so the fallback
// is what production builds use.
export const API_URL = import.meta.env.VITE_API_URL ?? 'https://api.neighborhue.app'
