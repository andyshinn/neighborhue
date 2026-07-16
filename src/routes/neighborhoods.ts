// src/routes/neighborhoods.ts
import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { getDb } from '../db/client'
import {
  getNeighborhood,
  getPaletteById,
  getPaletteColors,
  getDefaultPalette,
  insertNeighborhood,
  updateNeighborhood,
  deleteNeighborhood,
  getPaletteBySlug,
} from '../db/queries'
import type { NeighborhoodRow, NeighborhoodInsert } from '../db/queries'
import { rotation } from '../lib/rotation'
import { pickColorIndex } from '../lib/pick'
import { buildColor, type Color } from '../lib/color'
import { resolveColorList, parseCustomColors, type ColorEntry } from '../colors/resolve'
import { zJson, createSchema, patchSchema } from '../validators'
import { requireAdminSecret } from '../middleware/auth'
import { newNeighborhoodId, newAdminSecret } from '../lib/ids'

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

// Serializes a neighborhood's editable configuration. Never includes the admin secret.
async function serializeConfig(db: ReturnType<typeof getDb>, nb: NeighborhoodRow) {
  let paletteSlug: string | null = null
  if (nb.paletteId) {
    const p = await getPaletteById(db, nb.paletteId)
    paletteSlug = p?.slug ?? null
  }
  return {
    id: nb.id,
    name: nb.name,
    timezone: nb.timezone,
    rotation_hour: nb.rotationHour,
    palette: paletteSlug,
    custom_colors: nb.customColors ? (JSON.parse(nb.customColors) as unknown) : null,
  }
}

// Create
neighborhoodsRoute.post('/', zJson(createSchema), async (c) => {
  const body = c.req.valid('json')
  const db = getDb(c.env.DB)

  let paletteId: string | null = null
  if (body.palette) {
    const p = await getPaletteBySlug(db, body.palette)
    if (!p) return c.json({ error: 'palette_not_found', message: `Unknown palette: ${body.palette}` }, 400)
    paletteId = p.id
  }

  const id = newNeighborhoodId()
  const adminSecret = newAdminSecret()
  const row: NeighborhoodInsert = {
    id,
    adminSecret,
    name: body.name ?? null,
    timezone: body.timezone ?? 'UTC',
    rotationHour: body.rotation_hour ?? 7,
    paletteId,
    customColors: null,
    createdAt: Math.floor(Date.now() / 1000),
  }
  await insertNeighborhood(db, row)

  return c.json(
    {
      id,
      admin_secret: adminSecret,
      manage_url: `${c.env.MANAGE_URL_BASE}/manage/${adminSecret}`,
      name: row.name,
      timezone: row.timezone,
      rotation_hour: row.rotationHour,
      palette: body.palette ?? null,
      custom_colors: null,
    },
    201,
  )
})

// Manage (full editable config; never returns the secret)
neighborhoodsRoute.get('/:id/manage', requireAdminSecret, async (c) => {
  const db = getDb(c.env.DB)
  return c.json(await serializeConfig(db, c.get('neighborhood')))
})

// Update
neighborhoodsRoute.patch('/:id', requireAdminSecret, zJson(patchSchema), async (c) => {
  const db = getDb(c.env.DB)
  const nb = c.get('neighborhood')
  const body = c.req.valid('json')

  const patch: Partial<NeighborhoodInsert> = {}
  if (body.name !== undefined) patch.name = body.name
  if (body.timezone !== undefined) patch.timezone = body.timezone
  if (body.rotation_hour !== undefined) patch.rotationHour = body.rotation_hour
  if (body.palette !== undefined) {
    if (body.palette === null) {
      patch.paletteId = null
    } else {
      const p = await getPaletteBySlug(db, body.palette)
      if (!p) return c.json({ error: 'palette_not_found', message: `Unknown palette: ${body.palette}` }, 400)
      patch.paletteId = p.id
    }
  }
  if (body.custom_colors !== undefined) {
    patch.customColors = body.custom_colors === null ? null : JSON.stringify(body.custom_colors)
  }

  // No fields to update: return the current config unchanged (graceful no-op).
  if (Object.keys(patch).length === 0) {
    return c.json(await serializeConfig(db, nb))
  }
  await updateNeighborhood(db, nb.id, patch)
  const updated = await getNeighborhood(db, nb.id)
  return c.json(await serializeConfig(db, updated!))
})

// Delete
neighborhoodsRoute.delete('/:id', requireAdminSecret, async (c) => {
  const db = getDb(c.env.DB)
  await deleteNeighborhood(db, c.get('neighborhood').id)
  return c.body(null, 204)
})
