import { env, SELF } from 'cloudflare:test'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { seedPalettes } from '../seed/palettes'
import { getDb } from '../src/db/client'
import { insertNeighborhood } from '../src/db/queries'
import { weakEtag } from '../src/lib/etag'

const ID = '51fbbdef-62a7-4d19-b1b2-c91e1d721d20'
// Its own neighborhood so the PATCH below can't perturb the other tests.
const REPAINT_ID = '9a3f1c72-5d84-4a1e-9f60-7c2e0b5d8a41'
const REPAINT_SECRET = 'nh_sk_repaint_test'
const RECOLOR_ID = 'c7d20e85-3b19-4f6a-8e42-1d905fa7b3c6'
const RECOLOR_SECRET = 'nh_sk_recolor_test'

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
  await insertNeighborhood(db, {
    id: REPAINT_ID,
    adminSecret: REPAINT_SECRET,
    name: 'Repaint Test',
    timezone: 'America/Chicago',
    rotationHour: 7,
    paletteId: 'pal_rainbow',
    customColors: null,
    createdAt: 1_700_000_000,
  })
  await insertNeighborhood(db, {
    id: RECOLOR_ID,
    adminSecret: RECOLOR_SECRET,
    name: 'Recolor Test',
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
    expect(res.headers.get('ETag')).toMatch(/^W\/"[0-9a-f]{16}"$/)
    expect(res.headers.get('Cache-Control')).toMatch(/^public, max-age=\d+, stale-while-revalidate=\d+$/)
  })

  it('derives the ETag from the whole body, with the per-second countdown normalized out', async () => {
    const res = await SELF.fetch(`https://x/v1/neighborhoods/${ID}`)
    const body = (await res.json()) as Record<string, unknown>
    // Pins the exact construction: every field of the response — color, name,
    // timezone, rotation_hour, palette, day_index, the rotation timestamps — is
    // hash input, so no representation change can leave the validator behind.
    expect(res.headers.get('ETag')).toBe(await weakEtag(JSON.stringify({ ...body, seconds_until_rotation: 0 })))
  })

  it('advertises a short freshness window that never outlives the current color-day', async () => {
    const res = await SELF.fetch(`https://x/v1/neighborhoods/${ID}`)
    const body = (await res.json()) as { seconds_until_rotation: number }
    const cc = res.headers.get('Cache-Control') ?? ''
    const maxAge = Number(cc.match(/max-age=(\d+)/)?.[1])
    const swr = Number(cc.match(/stale-while-revalidate=(\d+)/)?.[1])
    expect(maxAge).toBeLessThanOrEqual(60)
    // A shared cache may serve without revalidating for at most max-age + swr.
    expect(maxAge + swr).toBeLessThanOrEqual(body.seconds_until_rotation)
  })

  it('holds the ETag steady as the countdown ticks, so background polls keep getting 304s', async () => {
    const first = await SELF.fetch(`https://x/v1/neighborhoods/${ID}`)
    const firstBody = (await first.json()) as { seconds_until_rotation: number }
    await new Promise((resolve) => setTimeout(resolve, 1200))
    const second = await SELF.fetch(`https://x/v1/neighborhoods/${ID}`)
    const secondBody = (await second.json()) as { seconds_until_rotation: number }

    expect(secondBody.seconds_until_rotation).not.toBe(firstBody.seconds_until_rotation)
    expect(second.headers.get('ETag')).toBe(first.headers.get('ETag'))
  })

  it('changes the ETag when the rotation carries it into the next color-day', async () => {
    const today = await SELF.fetch(`https://x/v1/neighborhoods/${ID}`)
    const todayBody = (await today.json()) as { day_index: number; next_rotation_at: string }

    try {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(Date.parse(todayBody.next_rotation_at) + 60_000))

      const tomorrow = await SELF.fetch(`https://x/v1/neighborhoods/${ID}`)
      const tomorrowBody = (await tomorrow.json()) as { day_index: number }

      expect(tomorrowBody.day_index).toBe(todayBody.day_index + 1)
      expect(tomorrow.headers.get('ETag')).not.toBe(today.headers.get('ETag'))

      // Yesterday's validator must not still buy a 304.
      const conditional = await SELF.fetch(`https://x/v1/neighborhoods/${ID}`, {
        headers: { 'If-None-Match': today.headers.get('ETag') ?? '' },
      })
      expect(conditional.status).toBe(200)
    } finally {
      vi.useRealTimers()
    }
  })

  it('changes the ETag when the palette changes within the same color-day', async () => {
    const before = await SELF.fetch(`https://x/v1/neighborhoods/${REPAINT_ID}`)
    const beforeBody = (await before.json()) as { day_index: number; palette: string }

    const patch = await SELF.fetch(`https://x/v1/neighborhoods/${REPAINT_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${REPAINT_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ palette: 'cool' }),
    })
    expect(patch.status).toBe(200)

    const after = await SELF.fetch(`https://x/v1/neighborhoods/${REPAINT_ID}`)
    const afterBody = (await after.json()) as { day_index: number; palette: string }

    expect(afterBody.day_index).toBe(beforeBody.day_index)
    expect(afterBody.palette).not.toBe(beforeBody.palette)
    expect(after.headers.get('ETag')).not.toBe(before.headers.get('ETag'))

    // And the old validator no longer buys a 304.
    const conditional = await SELF.fetch(`https://x/v1/neighborhoods/${REPAINT_ID}`, {
      headers: { 'If-None-Match': before.headers.get('ETag') ?? '' },
    })
    expect(conditional.status).toBe(200)
  })

  it('changes the ETag when only the rendered color changes', async () => {
    // custom_colors appears nowhere in the public body — its ONLY trace is
    // `color`. A single custom color also pins the pick, so this is the
    // rendered color moving the validator, not a config label going along
    // for the ride.
    const before = await SELF.fetch(`https://x/v1/neighborhoods/${RECOLOR_ID}`)
    const beforeBody = (await before.json()) as { day_index: number; palette: string; color: { hex: string } }
    expect(beforeBody.color.hex).not.toBe('#123456')

    const patch = await SELF.fetch(`https://x/v1/neighborhoods/${RECOLOR_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${RECOLOR_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_colors: [{ hex: '#123456', name: 'Test Blue' }] }),
    })
    expect(patch.status).toBe(200)

    const after = await SELF.fetch(`https://x/v1/neighborhoods/${RECOLOR_ID}`)
    const afterBody = (await after.json()) as { day_index: number; palette: string; color: { hex: string } }

    expect(afterBody.day_index).toBe(beforeBody.day_index)
    expect(afterBody.palette).toBe(beforeBody.palette)
    expect(afterBody.color.hex).toBe('#123456')
    expect(after.headers.get('ETag')).not.toBe(before.headers.get('ETag'))
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

  it('gives ?format=hex and ?format=rgb their own validators', async () => {
    const json = await SELF.fetch(`https://x/v1/neighborhoods/${ID}`)
    const hex = await SELF.fetch(`https://x/v1/neighborhoods/${ID}?format=hex`)
    const rgb = await SELF.fetch(`https://x/v1/neighborhoods/${ID}?format=rgb`)

    // Each validator is derived from the bytes that format actually returns.
    expect(hex.headers.get('ETag')).toBe(await weakEtag(await hex.clone().text()))
    expect(rgb.headers.get('ETag')).toBe(await weakEtag(await rgb.clone().text()))
    expect(new Set([json, hex, rgb].map((r) => r.headers.get('ETag'))).size).toBe(3)
  })

  it('honors If-None-Match on a text format', async () => {
    const first = await SELF.fetch(`https://x/v1/neighborhoods/${ID}?format=hex`)
    const etag = first.headers.get('ETag')
    if (!etag) throw new Error('expected an ETag header on the first response')
    const second = await SELF.fetch(`https://x/v1/neighborhoods/${ID}?format=hex`, {
      headers: { 'If-None-Match': etag },
    })
    expect(second.status).toBe(304)
  })

  it('honors If-None-Match with a 304', async () => {
    const first = await SELF.fetch(`https://x/v1/neighborhoods/${ID}`)
    const etag = first.headers.get('ETag')
    if (!etag) throw new Error('expected an ETag header on the first response')
    const second = await SELF.fetch(`https://x/v1/neighborhoods/${ID}`, { headers: { 'If-None-Match': etag } })
    expect(second.status).toBe(304)
  })

  it('repeats the ETag and Cache-Control on the 304', async () => {
    const first = await SELF.fetch(`https://x/v1/neighborhoods/${ID}`)
    const etag = first.headers.get('ETag')
    if (!etag) throw new Error('expected an ETag header on the first response')
    const second = await SELF.fetch(`https://x/v1/neighborhoods/${ID}`, { headers: { 'If-None-Match': etag } })

    expect(second.status).toBe(304)
    expect(second.headers.get('ETag')).toBe(etag)
    expect(second.headers.get('Cache-Control')).toMatch(/^public, max-age=\d+, stale-while-revalidate=\d+$/)
  })

  it('matches If-None-Match by weak comparison, in a list, and by wildcard', async () => {
    const first = await SELF.fetch(`https://x/v1/neighborhoods/${ID}`)
    const etag = first.headers.get('ETag')
    if (!etag) throw new Error('expected an ETag header on the first response')

    const strong = etag.replace(/^W\//, '')
    const list = `W/"aaaaaaaaaaaaaaaa", ${etag}`
    for (const header of [strong, list, '*']) {
      const res = await SELF.fetch(`https://x/v1/neighborhoods/${ID}`, { headers: { 'If-None-Match': header } })
      expect(res.status, `If-None-Match: ${header}`).toBe(304)
    }
  })

  it('serves 200 for a stale If-None-Match', async () => {
    const res = await SELF.fetch(`https://x/v1/neighborhoods/${ID}`, {
      headers: { 'If-None-Match': 'W/"ffffffffffffffff"' },
    })
    expect(res.status).toBe(200)
  })
})
