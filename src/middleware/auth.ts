// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../types'
import { getDb } from '../db/client'
import { getNeighborhood } from '../db/queries'

// Constant-time string comparison. Admin secrets are fixed-length, so the
// length check does not leak useful timing information.
export function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  if (ab.length !== bb.length) return false
  let diff = 0
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i]
  return diff === 0
}

export const requireAdminSecret = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization') ?? ''
  const token = header.match(/^Bearer\s+(.+)$/)?.[1]?.trim()
  if (!token) {
    return c.json({ error: 'unauthorized', message: 'Missing bearer admin secret' }, 401)
  }

  const db = getDb(c.env.DB)
  const nb = await getNeighborhood(db, c.req.param('id')!)
  if (!nb) {
    return c.json({ error: 'neighborhood_not_found', message: 'Unknown neighborhood' }, 404)
  }
  if (!constantTimeEqual(token, nb.adminSecret)) {
    return c.json({ error: 'forbidden', message: 'Invalid admin secret' }, 403)
  }

  c.set('neighborhood', nb)
  await next()
})
