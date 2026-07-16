import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './types'
import { neighborhoodsRoute } from './routes/neighborhoods'
import { palettesRoute } from './routes/palettes'

const app = new Hono<AppEnv>()

app.get('/', (c) => c.json({ name: 'neighborhue', version: 'v1' }))

// Public GET reads: any origin. Management (writes + /manage): the configured
// frontend origin only. Bearer secret is the real auth boundary; CORS is
// defense-in-depth for the browser frontend.
app.use('/v1/*', (c, next) => {
  const path = new URL(c.req.url).pathname
  const isManagement = c.req.method !== 'GET' || path.endsWith('/manage')
  const origin = isManagement ? (c.env.CORS_ORIGIN ?? '') : '*'
  return cors({
    origin,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'If-None-Match'],
  })(c, next)
})

app.route('/v1/neighborhoods', neighborhoodsRoute)
app.route('/v1/palettes', palettesRoute)

app.notFound((c) => c.json({ error: 'not_found', message: 'Not found' }, 404))

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'internal_error', message: 'Something went wrong' }, 500)
})

export default app
