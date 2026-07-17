import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { getDb } from '../src/db/client'
import { palettes } from '../src/db/schema'

describe('D1 migrations + drizzle client', () => {
  it('has the palettes table and it starts empty', async () => {
    const db = getDb(env.DB)
    const rows = await db.select().from(palettes).all()
    expect(rows).toEqual([])
  })
})
