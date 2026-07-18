import type { PublicNeighborhood } from '@neighborhue/api/types'
import { createClient } from './client'
import { ApiError, NeighborhoodNotFound, parseApiErrorBody } from './errors'

// Restores a real type over hc's `unknown` for GET /v1/neighborhoods/:id.
// Importing PublicNeighborhood (not restating it) keeps the compile-time
// seam: a field rename in apps/api fails this file's typecheck (spec §7.1).
export async function fetchNeighborhood(baseUrl: string, id: string): Promise<PublicNeighborhood> {
  const res = await createClient(baseUrl).v1.neighborhoods[':id'].$get({ param: { id } })
  if (res.ok) {
    return (await res.json()) as PublicNeighborhood
  }
  const body = parseApiErrorBody(await res.json().catch(() => null))
  if (res.status === 404) throw new NeighborhoodNotFound(body?.message)
  throw new ApiError(res.status, body?.error ?? 'error', body?.message ?? `Request failed: ${res.status}`)
}
