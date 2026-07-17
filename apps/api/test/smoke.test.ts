import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

describe('app skeleton', () => {
  it('serves the health root', async () => {
    const res = await SELF.fetch('https://example.com/')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ name: 'neighborhue', version: 'v1' })
  })

  it('returns the error shape for unknown routes', async () => {
    const res = await SELF.fetch('https://example.com/nope')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found', message: 'Not found' })
  })
})
