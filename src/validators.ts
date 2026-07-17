import { zValidator } from '@hono/zod-validator'
import { IANAZone } from 'luxon'
import { z } from 'zod'
import { HEX_RE } from './lib/color'

const timezone = z.string().refine((tz) => IANAZone.isValidZone(tz), { message: 'invalid timezone' })
const rotationHour = z.number().int().min(0).max(23)
const hex = z.string().regex(HEX_RE, 'invalid hex color')
const customColor = z.strictObject({ hex, name: z.string().max(120).optional() })

export const createSchema = z.strictObject({
  name: z.string().max(120).optional(),
  timezone: timezone.optional(),
  rotation_hour: rotationHour.optional(),
  palette: z.string().max(120).optional(),
})

export const patchSchema = z.strictObject({
  name: z.string().max(120).nullable().optional(),
  timezone: timezone.optional(),
  rotation_hour: rotationHour.optional(),
  palette: z.string().max(120).nullable().optional(),
  custom_colors: z.array(customColor).nullable().optional(),
})

// Shared JSON validator that emits the project error shape on failure.
export const zJson = <T extends z.ZodTypeAny>(schema: T) =>
  zValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.json({ error: 'invalid_request', message: result.error.issues.map((i) => i.message).join('; ') }, 400)
    }
  })
