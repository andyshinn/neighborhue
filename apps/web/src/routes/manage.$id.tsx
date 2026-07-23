import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ManageView } from '../components/ManageView'
import { API_URL } from '../lib/config'
import { classifyManageError, deleteNeighborhood, type ManagePatch, patchNeighborhood } from '../lib/manage'
import { manageConfigQueryOptions, neighborhoodQueryOptions, palettesQueryOptions } from '../lib/queries'
import stateStyles from './n.$id.states.module.css'

// ssr:false — the secret rides in the URL #fragment and must never reach the
// server (spec M3). Everything here runs client-side.
export const Route = createFileRoute('/manage/$id')({
  ssr: false,
  component: ManagePage,
})

function StateMessage({ title, body, cta }: { title: string; body: string; cta?: { to: '/create'; label: string } }) {
  return (
    <main className={stateStyles.state}>
      <h1 className={stateStyles.title}>{title}</h1>
      <p className={stateStyles.body}>{body}</p>
      {cta && (
        <Link to={cta.to} className={stateStyles.cta}>
          {cta.label}
        </Link>
      )}
    </main>
  )
}

function ManagePage() {
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  const [secret] = useState(() => (typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, '')))
  const [deleted, setDeleted] = useState(false)

  const configQuery = useQuery({ ...manageConfigQueryOptions(id, secret), enabled: secret !== '' })
  const publicQuery = useQuery(neighborhoodQueryOptions(id))
  const palettesQuery = useQuery(palettesQueryOptions())

  const [failedPatch, setFailedPatch] = useState<ManagePatch | null>(null)

  const save = useMutation({
    mutationFn: (patch: ManagePatch) => patchNeighborhood(API_URL, id, secret, patch),
    scope: { id: `manage-${id}` },
    onSuccess: (updated, patch) => {
      queryClient.setQueryData(manageConfigQueryOptions(id, secret).queryKey, updated)
      // A palette/custom change alters the server-computed color — refetch the public read (M6).
      if ('palette' in patch || 'custom_colors' in patch) {
        void queryClient.invalidateQueries({ queryKey: neighborhoodQueryOptions(id).queryKey })
      }
    },
    onError: (_err, patch) => setFailedPatch(patch),
  })

  const del = useMutation({
    mutationFn: () => deleteNeighborhood(API_URL, id, secret),
    onSuccess: () => setDeleted(true),
  })

  if (deleted) {
    return (
      <StateMessage
        title="This neighborhood was deleted"
        body="It's gone and its link now 404s. You can start a fresh one anytime — no account needed."
        cta={{ to: '/create', label: 'Create a new one' }}
      />
    )
  }
  if (secret === '') {
    return (
      <StateMessage
        title="This management link isn’t valid"
        body="A management link ends with #your-secret — copy the whole link, including the part after the # ."
      />
    )
  }
  if (configQuery.error) {
    const kind = classifyManageError(configQuery.error)
    if (kind === 'not-found')
      return (
        <StateMessage
          title="This neighborhood doesn’t exist"
          body="The link may be mistyped, or the neighborhood may have been deleted."
          cta={{ to: '/create', label: 'Create a neighborhood' }}
        />
      )
    if (kind === 'invalid-link')
      return (
        <StateMessage
          title="This management link isn’t valid"
          body="The secret in this link is wrong or missing. Use the exact private link you saved when you created the neighborhood."
        />
      )
    return <StateMessage title="Couldn’t load this neighborhood" body={configQuery.error.message} />
  }
  if (configQuery.isPending || publicQuery.isPending || palettesQuery.isPending) {
    return (
      <main className={stateStyles.state}>
        <p className={stateStyles.body}>Loading…</p>
      </main>
    )
  }
  if (publicQuery.error || palettesQuery.error || !configQuery.data || !publicQuery.data || !palettesQuery.data) {
    return <StateMessage title="Couldn’t load this neighborhood" body="Please try again." />
  }

  const saveStatus = failedPatch !== null ? 'error' : save.isPending ? 'saving' : save.isSuccess ? 'saved' : 'idle'
  const deleteStatus = del.isPending ? 'deleting' : del.isError ? 'error' : 'idle'

  return (
    <ManageView
      id={id}
      config={configQuery.data}
      neighborhood={publicQuery.data}
      palettes={palettesQuery.data}
      onSave={(patch) => save.mutate(patch)}
      saveStatus={saveStatus}
      onRetrySave={() => {
        if (failedPatch) save.mutate(failedPatch, { onSuccess: () => setFailedPatch(null) })
      }}
      onDelete={() => del.mutate()}
      deleteStatus={deleteStatus}
    />
  )
}
