import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import { HomeView } from '../components/HomeView'
import { DEMO_NEIGHBORHOOD_ID } from '../lib/config'
import { FALLBACK_EXAMPLE, toHeroExample } from '../lib/heroExample'
import { neighborhoodQueryOptions, palettesQueryOptions } from '../lib/queries'

const DESCRIPTION =
  'Neighborhue gives your street one shared color that changes every morning. Point your smart lights at a single link and the whole block lights up together.'

// SSR (route default): the hero paints today's real color with zero JS, and the
// countdown hydrates from the same reading rather than a second request.
//
// Both fetches are decorative for a MARKETING page — if the API is down, the
// page must still explain the product and sell the Create button. So the loader
// swallows failures, the component reads with non-suspense useQuery, and a
// missing reading resolves to the static fallback example.
export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(palettesQueryOptions()).catch(() => {}),
      DEMO_NEIGHBORHOOD_ID
        ? context.queryClient.ensureQueryData(neighborhoodQueryOptions(DEMO_NEIGHBORHOOD_ID)).catch(() => {})
        : Promise.resolve(),
    ])
  },
  head: () => ({
    meta: [
      { title: 'Neighborhue — the whole neighborhood glows the same color' },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: 'The whole neighborhood glows the same color.' },
      { property: 'og:description', content: DESCRIPTION },
    ],
  }),
  component: Home,
})

function Home() {
  const queryClient = useQueryClient()
  const { data: palettes } = useQuery(palettesQueryOptions())
  const { data: demo } = useQuery({
    ...neighborhoodQueryOptions(DEMO_NEIGHBORHOOD_ID ?? ''),
    enabled: DEMO_NEIGHBORHOOD_ID !== null,
  })

  // The example is only "live" with BOTH halves: the reading supplies the color
  // and the countdown, the palettes supply the swatch row's real colors.
  const example = demo && palettes ? toHeroExample(demo, palettes) : FALLBACK_EXAMPLE

  // Rotation rollover: the hero can sit open on a wall display past 7am. One
  // invalidate when the clock hits zero pulls the new color; unlike the share
  // page this needs no retry ladder, because a marketing page showing yesterday
  // for a few more minutes costs nothing.
  const onExpire = useCallback(() => {
    if (!DEMO_NEIGHBORHOOD_ID) return
    void queryClient.invalidateQueries({ queryKey: neighborhoodQueryOptions(DEMO_NEIGHBORHOOD_ID).queryKey })
  }, [queryClient])

  return <HomeView example={example} onExpire={onExpire} />
}
