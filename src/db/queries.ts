// src/db/queries.ts
import { asc, eq } from 'drizzle-orm'
import type { DB } from './client'
import { neighborhoods, paletteColors, palettes } from './schema'

export type NeighborhoodRow = typeof neighborhoods.$inferSelect
export type NeighborhoodInsert = typeof neighborhoods.$inferInsert
export type PaletteRow = typeof palettes.$inferSelect
export type PaletteColorRow = typeof paletteColors.$inferSelect

export async function getNeighborhood(db: DB, id: string): Promise<NeighborhoodRow | undefined> {
  return db.select().from(neighborhoods).where(eq(neighborhoods.id, id)).get()
}

export async function insertNeighborhood(db: DB, row: NeighborhoodInsert): Promise<void> {
  await db.insert(neighborhoods).values(row)
}

export async function updateNeighborhood(db: DB, id: string, patch: Partial<NeighborhoodInsert>): Promise<void> {
  await db.update(neighborhoods).set(patch).where(eq(neighborhoods.id, id))
}

export async function deleteNeighborhood(db: DB, id: string): Promise<void> {
  await db.delete(neighborhoods).where(eq(neighborhoods.id, id))
}

export async function getPaletteBySlug(db: DB, slug: string): Promise<PaletteRow | undefined> {
  return db.select().from(palettes).where(eq(palettes.slug, slug)).get()
}

export async function getPaletteById(db: DB, id: string): Promise<PaletteRow | undefined> {
  return db.select().from(palettes).where(eq(palettes.id, id)).get()
}

export async function getDefaultPalette(db: DB): Promise<PaletteRow | undefined> {
  return db.select().from(palettes).where(eq(palettes.isDefault, true)).get()
}

export async function getPaletteColors(db: DB, paletteId: string): Promise<PaletteColorRow[]> {
  return db
    .select()
    .from(paletteColors)
    .where(eq(paletteColors.paletteId, paletteId))
    .orderBy(asc(paletteColors.position), asc(paletteColors.id))
    .all()
}

export async function listActivePalettes(db: DB): Promise<PaletteRow[]> {
  return db.select().from(palettes).where(eq(palettes.isActive, true)).orderBy(asc(palettes.slug)).all()
}
