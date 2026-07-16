// src/routes/neighborhoods.ts
import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { getDb } from '../db/client'
import { getNeighborhood, getPaletteById, getPaletteColors, getDefaultPalette } from '../db/queries'
import type { NeighborhoodRow } from '../db/queries'
import { rotation } from '../lib/rotation'
import { pickColorIndex } from '../lib/pick'
import { buildColor, type Color } from '../lib/color'
import { resolveColorList, parseCustomColors, type ColorEntry } from '../colors/resolve'

export const neighborhoodsRoute = new Hono<AppEnv>()

// Resolves the ordered color list and derives today's color for a neighborhood.
async function todaysColor(
  db: ReturnType<typeof getDb>,
  nb: NeighborhoodRow,
): Promise<{ color: Color; dayIndex: number; info: ReturnType<typeof rotation>; paletteSlug: string | null }> {
  const info = rotation(nb.timezone, nb.rotationHour)

  const paletteColors: ColorEntry[] = nb.paletteId
    ? (await getPaletteColors(db, nb.paletteId)).map((c) => ({ hex: c.hex, name: c.name }))
    : []
  const def = await getDefaultPalette(db)
  const defColors: ColorEntry[] = def
    ? (await getPaletteColors(db, def.id)).map((c) => ({ hex: c.hex, name: c.name }))
    : []

  const list = resolveColorList({
    customColors: parseCustomColors(nb.customColors),
    paletteColors,
    defaultPaletteColors: defColors,
  })
  const idx = pickColorIndex(nb.id, info.dayIndex, list.length)
  const chosen = list[idx]

  let paletteSlug: string | null = null
  if (nb.paletteId) {
    const p = await getPaletteById(db, nb.paletteId)
    paletteSlug = p?.slug ?? null
  }

  return { color: buildColor(chosen.hex, chosen.name), dayIndex: info.dayIndex, info, paletteSlug }
}

neighborhoodsRoute.get('/:id', async (c) => {
  const id = c.req.param('id')
  const db = getDb(c.env.DB)
  const nb = await getNeighborhood(db, id)
  if (!nb) return c.json({ error: 'neighborhood_not_found', message: 'Unknown neighborhood' }, 404)

  const { color, dayIndex, info, paletteSlug } = await todaysColor(db, nb)
  const etag = `"${nb.id}-${dayIndex}"`
  const cacheControl = `public, max-age=${info.secondsUntilRotation}`

  if (c.req.header('If-None-Match') === etag) {
    return c.body(null, 304, { ETag: etag, 'Cache-Control': cacheControl })
  }

  const format = c.req.query('format')
  if (format === 'hex') {
    return c.text(color.hex, 200, { ETag: etag, 'Cache-Control': cacheControl })
  }
  if (format === 'rgb') {
    return c.text(color.rgb.join(','), 200, { ETag: etag, 'Cache-Control': cacheControl })
  }

  c.header('ETag', etag)
  c.header('Cache-Control', cacheControl)
  return c.json({
    id: nb.id,
    name: nb.name,
    timezone: nb.timezone,
    rotation_hour: nb.rotationHour,
    color,
    rotated_at: info.rotatedAt,
    next_rotation_at: info.nextRotationAt,
    seconds_until_rotation: info.secondsUntilRotation,
    palette: paletteSlug,
    day_index: dayIndex,
  })
})
