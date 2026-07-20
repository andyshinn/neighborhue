import type { AppType } from '@neighborhue/api'
import { hc } from 'hono/client'

/**
 * Typed API client. Takes an explicit baseUrl; callers pass
 * the shared API_URL (see src/lib/config.ts). Vite is now
 * installed here (frontend foundation spec) — the earlier scaffold note
 * that it was deliberately absent no longer applies.
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
