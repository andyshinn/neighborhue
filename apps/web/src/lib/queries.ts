import { queryOptions } from '@tanstack/react-query'
import { API_URL } from './config'
import { fetchNeighborhood } from './neighborhood'

export function neighborhoodQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['neighborhood', id],
    queryFn: () => fetchNeighborhood(API_URL, id),
  })
}
