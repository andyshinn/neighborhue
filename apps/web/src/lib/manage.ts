import type { ManageConfig } from '@neighborhue/api/types'
import { createClient } from './client'
import { ApiError, NeighborhoodNotFound, parseApiErrorBody } from './errors'

// Matches ManageConfig.custom_colors's element (name is optional, per the API).
export interface CustomColor {
  hex: string
  name?: string
}

export interface ManagePatch {
  name?: string | null
  timezone?: string
  rotation_hour?: number
  palette?: string | null
  custom_colors?: CustomColor[] | null
}

function bearer(secret: string) {
  return { headers: { Authorization: `Bearer ${secret}` } }
}

async function toError(res: { status: number; json: () => Promise<unknown> }): Promise<never> {
  const body = parseApiErrorBody(await res.json().catch(() => null))
  if (res.status === 404) throw new NeighborhoodNotFound(body?.message)
  throw new ApiError(res.status, body?.error ?? 'error', body?.message ?? `Request failed: ${res.status}`)
}

export async function fetchManageConfig(baseUrl: string, id: string, secret: string): Promise<ManageConfig> {
  const res = await createClient(baseUrl).v1.neighborhoods[':id'].manage.$get({ param: { id } }, bearer(secret))
  if (res.ok) return (await res.json()) as ManageConfig
  return toError(res)
}

export async function patchNeighborhood(
  baseUrl: string,
  id: string,
  secret: string,
  patch: ManagePatch,
): Promise<ManageConfig> {
  const res = await createClient(baseUrl).v1.neighborhoods[':id'].$patch({ param: { id }, json: patch }, bearer(secret))
  if (res.ok) return (await res.json()) as ManageConfig
  return toError(res)
}

export async function deleteNeighborhood(baseUrl: string, id: string, secret: string): Promise<void> {
  const res = await createClient(baseUrl).v1.neighborhoods[':id'].$delete({ param: { id } }, bearer(secret))
  if (!res.ok) await toError(res)
}

// Which error state the Manage page shows. 404 -> the neighborhood is gone;
// 401/403 -> the secret is missing/wrong (invalid link); anything else -> generic.
export function classifyManageError(err: unknown): 'invalid-link' | 'not-found' | 'error' {
  if (err instanceof NeighborhoodNotFound) return 'not-found'
  if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return 'invalid-link'
  return 'error'
}
