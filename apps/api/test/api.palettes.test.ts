import { env, SELF } from 'cloudflare:test'
import { beforeAll, describe, expect, it } from 'vitest'
import { seedPalettes } from '../seed/palettes'
import { getDb } from '../src/db/client'

beforeAll(async () => {
  await seedPalettes(getDb(env.DB))
})

describe('GET /v1/palettes', () => {
  it('lists the seeded palettes with colors', async () => {
    const res = await SELF.fetch('https://x/v1/palettes')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { palettes: Array<{ slug: string; colors: unknown[] }> }
    const slugs = body.palettes.map((p) => p.slug)
    expect(slugs).toContain('rainbow')
    expect(slugs.length).toBe(7)
    const rainbow = body.palettes.find((p) => p.slug === 'rainbow')
    expect(rainbow?.colors.length).toBe(7)
  })

  it('marks exactly one palette as the default (rainbow)', async () => {
    const res = await SELF.fetch('https://x/v1/palettes')
    const body = (await res.json()) as { palettes: Array<{ slug: string; is_default: boolean }> }
    const defaults = body.palettes.filter((p) => p.is_default)
    expect(defaults.length).toBe(1)
    expect(defaults[0].slug).toBe('rainbow')
  })
})
