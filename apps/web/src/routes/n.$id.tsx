import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { ColorField } from '../components/ColorField'
import { NeighborhoodNotFound } from '../lib/errors'
import { neighborhoodQueryOptions } from '../lib/queries'

export const Route = createFileRoute('/n/$id')({
  // SSR (default): the hue paints with zero JS and OG tags unfurl.
  loader: async ({ context, params }) => {
    try {
      // Primes the Query cache so the component's useSuspenseQuery is a hit,
      // and returns the data so `head` below can read today's live color.
      return await context.queryClient.ensureQueryData(neighborhoodQueryOptions(params.id))
    } catch (err) {
      // Unknown id -> real 404 status, not a 200 rendering a 404-shaped page.
      if (err instanceof NeighborhoodNotFound) throw notFound()
      throw err
    }
  },
  // The installed @tanstack/router-core exposes resolved `loaderData` on the
  // head context (AssetFnContextOptions#loaderData, typed from the loader's
  // return value), so we use it to unfurl today's actual color rather than a
  // static title (the stronger spec §9.2 outcome).
  head: ({ loaderData }) => {
    const label = loaderData ? (loaderData.color.name ?? loaderData.color.hex) : 'today’s color'
    return {
      meta: [
        { title: `${label} — Neighborhue` },
        { property: 'og:title', content: loaderData ? label : 'Neighborhue' },
        { property: 'og:description', content: 'The whole neighborhood glows the same color today.' },
      ],
    }
  },
  component: NeighborhoodShare,
})

function NeighborhoodShare() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(neighborhoodQueryOptions(id))
  return <ColorField name={data.name} color={data.color} />
}
