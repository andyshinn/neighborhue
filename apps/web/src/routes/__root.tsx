import '../styles/fonts.css'
import '../styles/tokens.css'
import '../styles/reset.css'

import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Neighborhue' },
    ],
  }),
  notFoundComponent: () => (
    <main style={{ padding: 40 }}>
      <h1>Not found</h1>
      <p>That neighborhood doesn’t exist. (Styled in Spec 2.)</p>
    </main>
  ),
  errorComponent: ({ error }) => (
    <main style={{ padding: 40 }}>
      <h1>Something went wrong</h1>
      <p>{error.message}</p>
    </main>
  ),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
