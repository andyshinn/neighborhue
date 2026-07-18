import { createFileRoute } from '@tanstack/react-router'

// ssr:false — the timezone default comes from Intl in the browser; SSR would
// render a wrong default and hydrate over it (spec §4.2). Screen is Spec 2.
export const Route = createFileRoute('/create')({
  ssr: false,
  component: () => <main style={{ padding: 40 }}>Create — coming in Spec 2.</main>,
})
