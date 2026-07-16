import { SELF, env } from 'cloudflare:test'
import { describe, it, beforeAll, expect } from 'vitest'
import { getDb } from '../src/db/client'
import { insertNeighborhood } from '../src/db/queries'
import { seedPalettes } from '../seed/palettes'

const ID = '51fbbdef-62a7-4d19-b1b2-c91e1d721d20'

beforeAll(async () => {
  const db = getDb(env.DB)
  await seedPalettes(db)
  await insertNeighborhood(db, {
    id: ID,
    adminSecret: 'nh_sk_read_test',
    name: 'Sunset Hill',
    timezone: 'America/Chicago',
    rotationHour: 7,
    paletteId: 'pal_rainbow',
    customColors: null,
    createdAt: 1_700_000_000,
  })
})

describe('GET /v1/neighborhoods/:id', () => {
  it('returns the full shape with cache headers', async () => {
    const res = await SELF.fetch(`https://x/v1/neighborhoods/${ID}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.id).toBe(ID)
    expect(body.name).toBe('Sunset Hill')
    expect(body.timezone).toBe('America/Chicago')
    expect(body.palette).toBe('rainbow')
    expect(typeof body.day_index).toBe('number')
    const color = body.color as Record<string, unknown>
    expect(typeof color.hex).toBe('string')
    expect(Array.isArray(color.rgb)).toBe(true)
    expect((color.rgb as number[]).length).toBe(3)
    expect((color.hsl as number[]).length).toBe(3)
    expect(res.headers.get('ETag')).toBe(`"${ID}-${body.day_index}"`)
    expect(res.headers.get('Cache-Control')).toMatch(/^public, max-age=\d+$/)
  })

  it('returns 404 for an unknown id', async () => {
    const res = await SELF.fetch('https://x/v1/neighborhoods/does-not-exist')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'neighborhood_not_found', message: 'Unknown neighborhood' })
  })

  it('supports ?format=hex and ?format=rgb as text/plain', async () => {
    const hex = await SELF.fetch(`https://x/v1/neighborhoods/${ID}?format=hex`)
    expect(hex.headers.get('Content-Type')).toMatch(/text\/plain/)
    expect(await hex.text()).toMatch(/^#[0-9A-Fa-f]{6}$/)

    const rgb = await SELF.fetch(`https://x/v1/neighborhoods/${ID}?format=rgb`)
    expect(await rgb.text()).toMatch(/^\d{1,3},\d{1,3},\d{1,3}$/)
  })

  it('honors If-None-Match with a 304', async () => {
    const first = await SELF.fetch(`https://x/v1/neighborhoods/${ID}`)
    const etag = first.headers.get('ETag')!
    const second = await SELF.fetch(`https://x/v1/neighborhoods/${ID}`, { headers: { 'If-None-Match': etag } })
    expect(second.status).toBe(304)
  })
})
