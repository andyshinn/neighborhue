import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { HomeView } from '../components/HomeView'
import { toHeroPalette } from '../lib/palette'
import { palettesQueryOptions } from '../lib/queries'

const DESCRIPTION =
  'Neighborhue gives your street one shared color that changes every morning. Point your smart lights at a single link and the whole block lights up together.'

// SSR (route default): the hero paints with zero JS and the OG tags unfurl.
// The palettes fetch only feeds the example card, so its failure must not take
// the marketing page down (spec H9) — the loader swallows the error and the
// component reads with a non-suspense useQuery, falling back to a copy-only hero.
export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(palettesQueryOptions())
    } catch {
      // decorative: the hero renders without its example card
    }
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
  const { data } = useQuery(palettesQueryOptions())
  return <HomeView palette={toHeroPalette(data ?? [])} />
}
