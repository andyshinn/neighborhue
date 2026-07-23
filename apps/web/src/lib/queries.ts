import { queryOptions } from '@tanstack/react-query'
import { fetchPalettes } from './client'
import { API_URL } from './config'
import { fetchManageConfig } from './manage'
import { fetchNeighborhood } from './neighborhood'
import type { PaletteSummary } from './palette'

export function neighborhoodQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['neighborhood', id],
    queryFn: () => fetchNeighborhood(API_URL, id),
  })
}

// Curated palettes are static content: fetch once and keep it.
export function palettesQueryOptions() {
  return queryOptions({
    queryKey: ['palettes'],
    queryFn: (): Promise<PaletteSummary[]> => fetchPalettes(API_URL),
    staleTime: Number.POSITIVE_INFINITY,
  })
}

// The secret authorizes the fetch but is NOT part of the cache key (spec M3):
// it never belongs in query state. One secret per id in practice.
export function manageConfigQueryOptions(id: string, secret: string) {
  return queryOptions({
    queryKey: ['manage', id],
    queryFn: () => fetchManageConfig(API_URL, id, secret),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  })
}
