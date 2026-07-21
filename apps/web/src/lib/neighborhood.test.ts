import type { CreatedNeighborhood } from '@neighborhue/api/types'
import { describe, expect, it, vi } from 'vitest'
import { createClient } from './client'
import { ApiError } from './errors'
import { createNeighborhood } from './neighborhood'

vi.mock('./client', () => ({ createClient: vi.fn() }))

const created: CreatedNeighborhood = {
  id: '11111111-1111-4111-8111-111111111111',
  admin_secret: 'nh_sk_secret',
  manage_url: 'https://neighborhue.app/manage/11111111-1111-4111-8111-111111111111#nh_sk_secret',
  name: 'Maple Street',
  timezone: 'America/New_York',
  rotation_hour: 7,
  palette: 'rainbow',
  custom_colors: null,
}

function stubPost(response: unknown) {
  vi.mocked(createClient).mockReturnValue({
    v1: { neighborhoods: { $post: vi.fn().mockResolvedValue(response) } },
  } as unknown as ReturnType<typeof createClient>)
}

describe('createNeighborhood', () => {
  it('returns the created neighborhood on success', async () => {
    stubPost({ ok: true, json: async () => created })
    await expect(createNeighborhood('https://api', { timezone: 'America/New_York', rotation_hour: 7 })).resolves.toEqual(
      created,
    )
  })

  it('throws ApiError with the API message on failure', async () => {
    stubPost({
      ok: false,
      status: 400,
      json: async () => ({ error: 'palette_not_found', message: 'Unknown palette: nope' }),
    })
    await expect(createNeighborhood('https://api', { timezone: 'UTC', rotation_hour: 7, palette: 'nope' })).rejects.toThrow(
      new ApiError(400, 'palette_not_found', 'Unknown palette: nope'),
    )
  })
})
