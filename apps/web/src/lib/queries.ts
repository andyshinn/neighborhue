import { queryOptions } from '@tanstack/react-query'
import { fetchNeighborhood } from './neighborhood'

const API_URL = import.meta.env.VITE_API_URL ?? 'https://api.neighborhue.app'

export function neighborhoodQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['neighborhood', id],
    queryFn: () => fetchNeighborhood(API_URL, id),
  })
}
