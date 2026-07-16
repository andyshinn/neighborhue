import { env } from 'cloudflare:test'
import { describe, it, beforeAll, expect } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../src/types'
import { getDb } from '../src/db/client'
import { insertNeighborhood } from '../src/db/queries'
import { requireAdminSecret, constantTimeEqual } from '../src/middleware/auth'

const ID = 'auth-nb'
const SECRET = 'nh_sk_correct_secret_value'

beforeAll(async () => {
  await insertNeighborhood(getDb(env.DB), {
    id: ID,
    adminSecret: SECRET,
    name: null,
    timezone: 'UTC',
    rotationHour: 7,
    paletteId: null,
    customColors: null,
    createdAt: 1_700_000_000,
  })
})

function app() {
  const a = new Hono<AppEnv>()
  a.get('/:id/guarded', requireAdminSecret, (c) => c.json({ ok: true, name: c.get('neighborhood').id }))
  return a
}

describe('constantTimeEqual', () => {
  it('is true only for identical strings', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true)
    expect(constantTimeEqual('abc', 'abd')).toBe(false)
    expect(constantTimeEqual('abc', 'abcd')).toBe(false)
  })
})

describe('requireAdminSecret', () => {
  it('401 when the bearer token is missing', async () => {
    const res = await app().request(`/${ID}/guarded`, {}, env)
    expect(res.status).toBe(401)
    expect(((await res.json()) as Record<string, unknown>).error).toBe('unauthorized')
  })
  it('403 when the secret is wrong', async () => {
    const res = await app().request(`/${ID}/guarded`, { headers: { Authorization: 'Bearer nh_sk_wrong' } }, env)
    expect(res.status).toBe(403)
    expect(((await res.json()) as Record<string, unknown>).error).toBe('forbidden')
  })
  it('404 when the neighborhood is unknown', async () => {
    const res = await app().request('/nope/guarded', { headers: { Authorization: 'Bearer x' } }, env)
    expect(res.status).toBe(404)
  })
  it('passes through with the correct secret', async () => {
    const res = await app().request(`/${ID}/guarded`, { headers: { Authorization: `Bearer ${SECRET}` } }, env)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, name: ID })
  })
})
