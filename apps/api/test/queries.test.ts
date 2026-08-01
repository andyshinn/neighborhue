import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { seedPalettes } from '../seed/palettes'
import { getDb } from '../src/db/client'
import {
  deleteNeighborhood,
  getDefaultPalette,
  getNeighborhood,
  getPaletteBySlug,
  getPaletteColors,
  insertNeighborhood,
  listActivePalettes,
  updateNeighborhood,
} from '../src/db/queries'

describe('neighborhood queries', () => {
  it('inserts, reads, updates, and deletes a neighborhood', async () => {
    const db = getDb(env.DB)
    await insertNeighborhood(db, {
      id: 'nb-1',
      adminSecret: 'nh_sk_test',
      name: 'Test',
      timezone: 'UTC',
      rotationHour: 7,
      paletteId: null,
      customColors: null,
      createdAt: 1_700_000_000,
    })
    expect((await getNeighborhood(db, 'nb-1'))?.name).toBe('Test')

    await updateNeighborhood(db, 'nb-1', { rotationHour: 9 })
    expect((await getNeighborhood(db, 'nb-1'))?.rotationHour).toBe(9)

    await deleteNeighborhood(db, 'nb-1')
    expect(await getNeighborhood(db, 'nb-1')).toBeUndefined()
  })
})

describe('palette queries', () => {
  it('reads palettes by slug/default and ordered colors', async () => {
    const db = getDb(env.DB)
    await seedPalettes(db)

    expect((await getPaletteBySlug(db, 'rainbow'))?.name).toBe('Rainbow')
    expect((await getDefaultPalette(db))?.slug).toBe('rainbow')

    const colors = await getPaletteColors(db, 'pal_rainbow')
    expect(colors.map((c) => c.position)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(colors[0].hex).toBe('#FF0000')

    const active = await listActivePalettes(db)
    expect(active.length).toBe(7)
  })
})
