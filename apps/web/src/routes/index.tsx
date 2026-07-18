import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => (
    <main style={{ padding: 40 }}>
      <div style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-card)', borderRadius: 22, padding: 24 }}>
        Neighborhue — foundation skeleton.
      </div>
    </main>
  ),
})
