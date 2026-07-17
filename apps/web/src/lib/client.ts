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
