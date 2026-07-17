import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

describe('CORS', () => {
  it('allows any origin on public reads', async () => {
    const res = await SELF.fetch('https://x/v1/palettes', { headers: { Origin: 'https://anywhere.example' } })
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('exposes the ETag header so browser clients can read it cross-origin', async () => {
    const res = await SELF.fetch('https://x/v1/palettes', { headers: { Origin: 'https://anywhere.example' } })
    expect(res.headers.get('Access-Control-Expose-Headers')).toContain('ETag')
  })
})
