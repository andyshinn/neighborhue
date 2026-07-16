import { Hono } from 'hono'
import type { AppEnv } from './types'
import { neighborhoodsRoute } from './routes/neighborhoods'

const app = new Hono<AppEnv>()

app.get('/', (c) => c.json({ name: 'neighborhue', version: 'v1' }))

app.route('/v1/neighborhoods', neighborhoodsRoute)

app.notFound((c) => c.json({ error: 'not_found', message: 'Not found' }, 404))

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'internal_error', message: 'Something went wrong' }, 500)
})

export default app
