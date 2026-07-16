import { env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import { getDb } from '../src/db/client'
import { palettes, paletteColors } from '../src/db/schema'
import { eq } from 'drizzle-orm'
import { seedPalettes, PALETTES } from '../seed/palettes'

describe('seedPalettes', () => {
  it('seeds all seven palettes with rainbow as default', async () => {
    const db = getDb(env.DB)
    await seedPalettes(db)
    const rows = await db.select().from(palettes).all()
    expect(rows.length).toBe(7)
    const def = rows.filter((p) => p.isDefault)
    expect(def.map((p) => p.slug)).toEqual(['rainbow'])
  })

  it('seeds the correct color counts per palette', async () => {
    const db = getDb(env.DB)
    await seedPalettes(db)
    for (const p of PALETTES) {
      const colors = await db.select().from(paletteColors).where(eq(paletteColors.paletteId, `pal_${p.slug}`)).all()
      expect(colors.length).toBe(p.colors.length)
    }
  })

  it('is idempotent (re-seeding does not duplicate)', async () => {
    const db = getDb(env.DB)
    await seedPalettes(db)
    await seedPalettes(db)
    const rows = await db.select().from(palettes).all()
    expect(rows.length).toBe(7)
  })
})
