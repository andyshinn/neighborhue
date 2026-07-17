// src/db/schema.ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const neighborhoods = sqliteTable('neighborhoods', {
  id: text('id').primaryKey(), // public UUID v4 — goes in the share URL
  adminSecret: text('admin_secret').notNull().unique(), // unguessable management token
  name: text('name'),
  timezone: text('timezone').notNull().default('UTC'), // IANA
  rotationHour: integer('rotation_hour').notNull().default(7), // 0–23
  paletteId: text('palette_id').references(() => palettes.id), // nullable
  customColors: text('custom_colors'), // nullable JSON: [{ hex, name }]
  createdAt: integer('created_at').notNull(), // unix seconds
})

export const palettes = sqliteTable('palettes', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
})

export const paletteColors = sqliteTable('palette_colors', {
  id: text('id').primaryKey(),
  paletteId: text('palette_id')
    .notNull()
    .references(() => palettes.id, { onDelete: 'cascade' }),
  hex: text('hex').notNull(),
  name: text('name'),
  position: integer('position').notNull().default(0), // stable ordering
})
