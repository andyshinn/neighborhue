// src/routes/neighborhoods.ts
import { Hono } from 'hono'
import { type ColorEntry, parseCustomColors, resolveColorList } from '../colors/resolve'
import { getDb } from '../db/client'
import type { NeighborhoodInsert, NeighborhoodRow } from '../db/queries'
import {
  deleteNeighborhood,
  getDefaultPalette,
  getNeighborhood,
  getPaletteById,
  getPaletteBySlug,
  getPaletteColors,
  insertNeighborhood,
  updateNeighborhood,
} from '../db/queries'
import { cacheControlFor } from '../lib/cache'
import { buildColor, type Color } from '../lib/color'
import { ifNoneMatchSatisfied, weakEtag } from '../lib/etag'
import { newAdminSecret, newNeighborhoodId } from '../lib/ids'
import { pickColorIndex } from '../lib/pick'
import { rotation } from '../lib/rotation'
import { requireAdminSecret } from '../middleware/auth'
import type { AppEnv, CreatedNeighborhood, ManageConfig, PublicNeighborhood } from '../types'
import { createSchema, patchSchema, zJson } from '../validators'

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
  const defColors: ColorEntry[] = def ? (await getPaletteColors(db, def.id)).map((c) => ({ hex: c.hex, name: c.name })) : []

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
    custom_colors: nb.customColors ? (JSON.parse(nb.customColors) as Array<{ hex: string; name?: string }>) : null,
  } satisfies ManageConfig
}

export const neighborhoodsRoute = new Hono<AppEnv>()
  .get('/:id', async (c) => {
    const id = c.req.param('id')
    const db = getDb(c.env.DB)
    const nb = await getNeighborhood(db, id)
    if (!nb) return c.json({ error: 'neighborhood_not_found', message: 'Unknown neighborhood' }, 404)

    const { color, dayIndex, info, paletteSlug } = await todaysColor(db, nb)
    const cacheControl = cacheControlFor(info.secondsUntilRotation)
    const format = c.req.query('format')

    // Each representation is validated by its own bytes, so `?format=hex` and
    // the JSON body carry independent ETags — a name change moves the JSON
    // validator and correctly leaves the hex one alone.
    if (format === 'hex' || format === 'rgb') {
      const body = format === 'hex' ? color.hex : color.rgb.join(',')
      const etag = await weakEtag(body)
      if (ifNoneMatchSatisfied(c.req.header('If-None-Match'), etag)) {
        return c.body(null, 304, { ETag: etag, 'Cache-Control': cacheControl })
      }
      return c.text(body, 200, { ETag: etag, 'Cache-Control': cacheControl })
    }

    const payload = {
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
    } satisfies PublicNeighborhood

    // Hash the body we are about to send, so anything that can change it —
    // palette, custom colors, name, timezone, rotation hour, the rotation
    // itself — moves the validator.
    //
    // `seconds_until_rotation` is the one exclusion: it ticks every second, so
    // hashing it would mint a new ETag per request and no conditional client
    // would ever see a 304. That exclusion is exactly why this is a WEAK
    // validator — two responses sharing an ETag are equivalent, not
    // byte-identical. Clients that need a live countdown derive it from the
    // absolute `next_rotation_at`, which IS covered here.
    const etag = await weakEtag(JSON.stringify({ ...payload, seconds_until_rotation: 0 }))

    if (ifNoneMatchSatisfied(c.req.header('If-None-Match'), etag)) {
      return c.body(null, 304, { ETag: etag, 'Cache-Control': cacheControl })
    }

    c.header('ETag', etag)
    c.header('Cache-Control', cacheControl)
    return c.json(payload)
  })
  // Create
  .post('/', zJson(createSchema), async (c) => {
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
    // Resolved once and reused below: `NeighborhoodInsert` (Drizzle's $inferInsert)
    // widens `name`/`timezone`/`rotationHour` to include `undefined` because
    // those columns have DB-side defaults, so reading them back off `row` loses
    // the narrower type these locals carry. Values are identical either way.
    const name = body.name ?? null
    const timezone = body.timezone ?? 'UTC'
    const rotationHour = body.rotation_hour ?? 7
    const row: NeighborhoodInsert = {
      id,
      adminSecret,
      name,
      timezone,
      rotationHour,
      paletteId,
      customColors: null,
      createdAt: Math.floor(Date.now() / 1000),
    }
    await insertNeighborhood(db, row)

    return c.json(
      {
        id,
        admin_secret: adminSecret,
        manage_url: `${c.env.MANAGE_URL_BASE}/manage/${id}#${adminSecret}`,
        name,
        timezone,
        rotation_hour: rotationHour,
        palette: body.palette ?? null,
        custom_colors: null,
      } satisfies CreatedNeighborhood,
      201,
    )
  })
  // Manage (full editable config; never returns the secret)
  .get('/:id/manage', requireAdminSecret, async (c) => {
    const db = getDb(c.env.DB)
    return c.json(await serializeConfig(db, c.get('neighborhood')))
  })
  // Update
  .patch('/:id', requireAdminSecret, zJson(patchSchema), async (c) => {
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
    // Absent only if the row was deleted concurrently with this PATCH.
    if (!updated) return c.json({ error: 'neighborhood_not_found', message: 'Unknown neighborhood' }, 404)
    return c.json(await serializeConfig(db, updated))
  })
  // Delete
  .delete('/:id', requireAdminSecret, async (c) => {
    const db = getDb(c.env.DB)
    await deleteNeighborhood(db, c.get('neighborhood').id)
    return c.body(null, 204)
  })
