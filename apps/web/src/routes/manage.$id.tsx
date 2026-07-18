import { createFileRoute } from '@tanstack/react-router'

// ssr:false — the secret must never be evaluated server-side. It rides in the
// URL #fragment (spec §4.4), which only the client can read. Screen is Spec 2.
export const Route = createFileRoute('/manage/$id')({
  ssr: false,
  component: ManageStub,
})

function ManageStub() {
  const { id } = Route.useParams()
  // Demonstrates the fragment mechanism the real Manage page will use.
  const secret = typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, '')
  return (
    <main style={{ padding: 40 }}>
      Manage {id} — coming in Spec 2. Secret present: {secret ? 'yes' : 'no'}.
    </main>
  )
}
