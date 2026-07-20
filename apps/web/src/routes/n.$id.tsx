import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { useCallback, useRef } from 'react'
import { colorTheme } from '../color/theme'
import { DetailsPanel } from '../components/DetailsPanel'
import { ShareColorField } from '../components/ShareColorField'
import { useCountdown } from '../hooks/useCountdown'
import { NeighborhoodNotFound } from '../lib/errors'
import { resolvePalette } from '../lib/palette'
import { neighborhoodQueryOptions, palettesQueryOptions } from '../lib/queries'
import styles from './n.$id.module.css'
import stateStyles from './n.$id.states.module.css'

export const Route = createFileRoute('/n/$id')({
  // SSR (default): the hue paints with zero JS and OG tags unfurl.
  loader: async ({ context, params }) => {
    try {
      // Both prime the Query cache so the component's useSuspenseQuery calls
      // are hits; the neighborhood is returned so `head` can read today's color.
      const [neighborhood] = await Promise.all([
        context.queryClient.ensureQueryData(neighborhoodQueryOptions(params.id)),
        context.queryClient.ensureQueryData(palettesQueryOptions()),
      ])
      return neighborhood
    } catch (err) {
      // Unknown id -> real 404 status, not a 200 rendering a 404-shaped page.
      if (err instanceof NeighborhoodNotFound) throw notFound()
      throw err
    }
  },
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
  notFoundComponent: () => (
    <main className={stateStyles.state}>
      <h1 className={stateStyles.title}>This neighborhood doesn’t exist</h1>
      <p className={stateStyles.body}>
        The link may be mistyped, or the neighborhood may have been deleted. You can start a new one in about a minute — no
        account needed.
      </p>
      <Link to="/create" className={stateStyles.cta}>
        Create a neighborhood
      </Link>
    </main>
  ),
  errorComponent: ({ error }) => <ShareError message={error.message} />,
})

function NeighborhoodShare() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(neighborhoodQueryOptions(id))
  const { data: palettes } = useSuspenseQuery(palettesQueryOptions())
  const queryClient = useQueryClient()

  const palette = resolvePalette(data.palette, palettes)
  const theme = colorTheme(data.color.hex)

  // Rotation rollover (spec S8): refetch after a grace period so the new color
  // arrives, backing off if the server hasn't rolled over yet (client clock
  // ahead). The backoff resets when a new day's color lands (next_rotation_at
  // changes) — compared during render, which is safe for a ref here because the
  // reset is idempotent and doesn't drive a re-render — so each rotation gets a
  // fresh 2s-start backoff even on a page left open for days on a wall display.
  const attempts = useRef(0)
  const lastRotation = useRef(data.next_rotation_at)
  if (lastRotation.current !== data.next_rotation_at) {
    lastRotation.current = data.next_rotation_at
    attempts.current = 0
  }

  // useCountdown fires this once when the clock hits zero; from here the route
  // owns the retry loop. Refetch after a backoff, and if the server hasn't
  // rolled over yet — its next_rotation_at is still in the past because the
  // client clock ran ahead — back off further and try again. Once the new
  // color lands, next_rotation_at moves into the future, the loop stops, and
  // the render-time reset above zeroes the backoff for the next rotation.
  const onExpire = useCallback(() => {
    const key = neighborhoodQueryOptions(id).queryKey
    const retry = async () => {
      const delay = 2000 * 2 ** Math.min(attempts.current, 3) // 2s, 4s, 8s, 16s (capped)
      attempts.current += 1
      await new Promise((resolve) => setTimeout(resolve, delay))
      await queryClient.invalidateQueries({ queryKey: key })
      const fresh = queryClient.getQueryData(key)
      if (fresh && Date.parse(fresh.next_rotation_at) <= Date.now()) {
        void retry() // still on the old color — keep trying with a longer delay
      }
    }
    void retry()
  }, [queryClient, id])

  const seconds = useCountdown(data.seconds_until_rotation, data.next_rotation_at, onExpire)

  const shareUrl = typeof window === 'undefined' ? `https://neighborhue.app/n/${id}` : window.location.href

  return (
    <main className={styles.page}>
      <ShareColorField
        name={data.name}
        color={data.color}
        paletteName={palette.kind === 'custom' ? 'Custom colors' : palette.name}
      />
      <DetailsPanel
        name={data.name}
        neighborhoodId={id}
        shareUrl={shareUrl}
        seconds={seconds}
        palette={palette}
        hue={data.color.hex}
        ink={theme.ink}
      />
    </main>
  )
}

function ShareError({ message }: { message: string }) {
  const router = useRouter()
  return (
    <main className={stateStyles.state}>
      <h1 className={stateStyles.title}>Couldn’t load today’s color</h1>
      <p className={stateStyles.body}>{message}</p>
      <button type="button" className={stateStyles.cta} onClick={() => router.invalidate()}>
        Try again
      </button>
    </main>
  )
}
