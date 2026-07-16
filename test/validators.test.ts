import { describe, it, expect } from 'vitest'
import { createSchema, patchSchema } from '../src/validators'

describe('createSchema', () => {
  it('accepts a valid body', () => {
    expect(createSchema.safeParse({ name: 'A', timezone: 'America/Chicago', rotation_hour: 7, palette: 'rainbow' }).success).toBe(true)
  })
  it('accepts an empty body (all optional)', () => {
    expect(createSchema.safeParse({}).success).toBe(true)
  })
  it('rejects an unknown IANA timezone', () => {
    expect(createSchema.safeParse({ timezone: 'Mars/Olympus' }).success).toBe(false)
  })
  it('rejects rotation_hour out of 0-23', () => {
    expect(createSchema.safeParse({ rotation_hour: 24 }).success).toBe(false)
    expect(createSchema.safeParse({ rotation_hour: -1 }).success).toBe(false)
  })
  it('rejects unknown keys', () => {
    expect(createSchema.safeParse({ nope: 1 }).success).toBe(false)
  })
})

describe('patchSchema', () => {
  it('accepts custom_colors with valid hex', () => {
    expect(patchSchema.safeParse({ custom_colors: [{ hex: '#FF0000', name: 'Red' }] }).success).toBe(true)
  })
  it('accepts null to clear palette/custom_colors', () => {
    expect(patchSchema.safeParse({ palette: null, custom_colors: null }).success).toBe(true)
  })
  it('rejects malformed hex in custom_colors', () => {
    expect(patchSchema.safeParse({ custom_colors: [{ hex: 'red' }] }).success).toBe(false)
  })
})
