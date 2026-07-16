import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
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
    exposeHeaders: ['ETag'],
  })(c, next)
})

app.route('/v1/neighborhoods', neighborhoodsRoute)
app.route('/v1/palettes', palettesRoute)

app.notFound((c) => c.json({ error: 'not_found', message: 'Not found' }, 404))

app.onError((err, c) => {
  // Hono's built-in json/form body validators throw HTTPException(400) when the
  // request body can't be parsed (e.g. empty or malformed JSON). The zJson hook
  // only runs on zod validation failures, not parse failures, so surface those
  // here as a 400 in the project's error shape instead of falling through to 500.
  if (err instanceof HTTPException) {
    return c.json({ error: 'invalid_request', message: err.message }, err.status)
  }
  console.error(err)
  return c.json({ error: 'internal_error', message: 'Something went wrong' }, 500)
})

export default app
