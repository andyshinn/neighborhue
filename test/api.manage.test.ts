import { SELF, env } from 'cloudflare:test'
import { describe, it, beforeAll, expect } from 'vitest'
import { getDb } from '../src/db/client'
import { seedPalettes } from '../seed/palettes'

beforeAll(async () => {
  await seedPalettes(getDb(env.DB))
})

async function create(body: unknown) {
  return SELF.fetch('https://x/v1/neighborhoods', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /v1/neighborhoods', () => {
  it('creates and returns id + admin_secret + manage_url', async () => {
    const res = await create({ name: 'Hill', timezone: 'America/Chicago', rotation_hour: 7, palette: 'rainbow' })
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, string>
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.admin_secret.startsWith('nh_sk_')).toBe(true)
    expect(body.admin_secret.slice(6).length).toBeGreaterThanOrEqual(43)
    expect(body.manage_url).toBe(`https://neighborhue.app/manage/${body.admin_secret}`)
    expect(body.palette).toBe('rainbow')
  })

  it('produces unique secrets across creates', async () => {
    const a = (await (await create({})).json()) as Record<string, string>
    const b = (await (await create({})).json()) as Record<string, string>
    expect(a.admin_secret).not.toBe(b.admin_secret)
  })

  it('rejects an unknown palette with 400', async () => {
    const res = await create({ palette: 'nope' })
    expect(res.status).toBe(400)
    expect(((await res.json()) as Record<string, string>).error).toBe('palette_not_found')
  })

  it('rejects invalid timezone / rotation_hour with 400', async () => {
    expect((await create({ timezone: 'Mars/Base' })).status).toBe(400)
    expect((await create({ rotation_hour: 99 })).status).toBe(400)
  })
})

describe('GET/PATCH/DELETE management', () => {
  async function fresh() {
    const body = (await (await create({ name: 'Orig', palette: 'rainbow' })).json()) as Record<string, string>
    return body
  }

  it('manage requires auth and never returns the secret', async () => {
    const nb = await fresh()
    const noAuth = await SELF.fetch(`https://x/v1/neighborhoods/${nb.id}/manage`)
    expect(noAuth.status).toBe(401)

    const wrong = await SELF.fetch(`https://x/v1/neighborhoods/${nb.id}/manage`, {
      headers: { Authorization: 'Bearer nh_sk_wrong' },
    })
    expect(wrong.status).toBe(403)

    const ok = await SELF.fetch(`https://x/v1/neighborhoods/${nb.id}/manage`, {
      headers: { Authorization: `Bearer ${nb.admin_secret}` },
    })
    expect(ok.status).toBe(200)
    const cfg = (await ok.json()) as Record<string, unknown>
    expect(cfg).not.toHaveProperty('admin_secret')
    expect(cfg.name).toBe('Orig')
    expect(cfg.palette).toBe('rainbow')
  })

  it('patch updates fields', async () => {
    const nb = await fresh()
    const res = await SELF.fetch(`https://x/v1/neighborhoods/${nb.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${nb.admin_secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed', rotation_hour: 9, palette: 'vivid' }),
    })
    expect(res.status).toBe(200)
    const cfg = (await res.json()) as Record<string, unknown>
    expect(cfg).not.toHaveProperty('admin_secret')
    expect(cfg.name).toBe('Renamed')
    expect(cfg.rotation_hour).toBe(9)
    expect(cfg.palette).toBe('vivid')
  })

  it('patch with an empty body is a graceful no-op (200, config unchanged)', async () => {
    const nb = await fresh()
    const res = await SELF.fetch(`https://x/v1/neighborhoods/${nb.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${nb.admin_secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200)
    const cfg = (await res.json()) as Record<string, unknown>
    expect(cfg).not.toHaveProperty('admin_secret')
    expect(cfg.name).toBe('Orig')
    expect(cfg.palette).toBe('rainbow')
  })

  it('patch rejects invalid body with 400', async () => {
    const nb = await fresh()
    const res = await SELF.fetch(`https://x/v1/neighborhoods/${nb.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${nb.admin_secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rotation_hour: 30 }),
    })
    expect(res.status).toBe(400)
  })

  it('delete returns 204 and the neighborhood is gone', async () => {
    const nb = await fresh()
    const del = await SELF.fetch(`https://x/v1/neighborhoods/${nb.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${nb.admin_secret}` },
    })
    expect(del.status).toBe(204)
    const read = await SELF.fetch(`https://x/v1/neighborhoods/${nb.id}`)
    expect(read.status).toBe(404)
  })
})
