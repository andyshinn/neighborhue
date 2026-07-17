// src/routes/palettes.ts
import { Hono } from 'hono'
import { getDb } from '../db/client'
import { getPaletteColors, listActivePalettes } from '../db/queries'
import type { AppEnv } from '../types'

export const palettesRoute = new Hono<AppEnv>().get('/', async (c) => {
  const db = getDb(c.env.DB)
  const list = await listActivePalettes(db)
  const palettes = await Promise.all(
    list.map(async (p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description,
      colors: (await getPaletteColors(db, p.id)).map((col) => ({ hex: col.hex, name: col.name })),
    })),
  )
  return c.json({ palettes })
})
