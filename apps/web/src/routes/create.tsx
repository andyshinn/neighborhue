import type { CreatedNeighborhood } from '@neighborhue/api/types'
import { useMutation, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { CreateView } from '../components/CreateView'
import { API_URL } from '../lib/config'
import { type CreateBody, createNeighborhood } from '../lib/neighborhood'
import { palettesQueryOptions } from '../lib/queries'

// ssr:false — the timezone default comes from Intl in the browser; SSR would
// render a wrong default and hydrate over it (spec C12). The loader still runs
// client-side to prime the palettes cache before the picker reads it.
export const Route = createFileRoute('/create')({
  ssr: false,
  loader: ({ context }) => context.queryClient.ensureQueryData(palettesQueryOptions()),
  component: CreatePage,
})

function CreatePage() {
  const { data: palettes } = useSuspenseQuery(palettesQueryOptions())
  const [created, setCreated] = useState<CreatedNeighborhood | null>(null)
  // Held in state only — the secret is shown once and never persisted (spec C5).
  const [initialTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)

  const mutation = useMutation({
    mutationFn: (body: CreateBody) => createNeighborhood(API_URL, body),
    onSuccess: setCreated,
  })

  return (
    <CreateView
      palettes={palettes}
      initialTimezone={initialTimezone}
      onCreate={(body) => mutation.mutate(body)}
      pending={mutation.isPending}
      error={mutation.error ? mutation.error.message : null}
      created={created}
    />
  )
}
