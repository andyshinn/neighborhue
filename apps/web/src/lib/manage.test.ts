import type { ManageConfig } from '@neighborhue/api/types'
import { describe, expect, it, vi } from 'vitest'
import { createClient } from './client'
import { ApiError, NeighborhoodNotFound } from './errors'
import { classifyManageError, deleteNeighborhood, fetchManageConfig, patchNeighborhood } from './manage'

vi.mock('./client', () => ({ createClient: vi.fn() }))

const config: ManageConfig = {
  id: 'abc',
  name: 'Maple Street',
  timezone: 'America/New_York',
  rotation_hour: 7,
  palette: 'rainbow',
  custom_colors: null,
}

function stub(method: '$get' | '$patch' | '$delete', response: unknown) {
  vi.mocked(createClient).mockReturnValue({
    v1: {
      neighborhoods: {
        ':id': { manage: { $get: vi.fn().mockResolvedValue(response) }, [method]: vi.fn().mockResolvedValue(response) },
      },
    },
  } as unknown as ReturnType<typeof createClient>)
}

describe('manage client', () => {
  it('fetchManageConfig returns the config on success', async () => {
    stub('$get', { ok: true, json: async () => config })
    await expect(fetchManageConfig('https://api', 'abc', 'nh_sk_x')).resolves.toEqual(config)
  })

  it('fetchManageConfig throws NeighborhoodNotFound on 404', async () => {
    stub('$get', {
      ok: false,
      status: 404,
      json: async () => ({ error: 'neighborhood_not_found', message: 'Unknown neighborhood' }),
    })
    await expect(fetchManageConfig('https://api', 'abc', 'nh_sk_x')).rejects.toBeInstanceOf(NeighborhoodNotFound)
  })

  it('fetchManageConfig throws ApiError(403) on a bad secret', async () => {
    stub('$get', { ok: false, status: 403, json: async () => ({ error: 'forbidden', message: 'Invalid admin secret' }) })
    await expect(fetchManageConfig('https://api', 'abc', 'bad')).rejects.toMatchObject({ status: 403 })
  })

  it('patchNeighborhood returns the updated config', async () => {
    stub('$patch', { ok: true, json: async () => ({ ...config, name: 'Renamed' }) })
    await expect(patchNeighborhood('https://api', 'abc', 'nh_sk_x', { name: 'Renamed' })).resolves.toMatchObject({
      name: 'Renamed',
    })
  })

  it('deleteNeighborhood resolves on 204', async () => {
    stub('$delete', { ok: true })
    await expect(deleteNeighborhood('https://api', 'abc', 'nh_sk_x')).resolves.toBeUndefined()
  })

  it('classifyManageError maps errors to states', () => {
    expect(classifyManageError(new NeighborhoodNotFound())).toBe('not-found')
    expect(classifyManageError(new ApiError(403, 'forbidden', 'x'))).toBe('invalid-link')
    expect(classifyManageError(new ApiError(401, 'unauthorized', 'x'))).toBe('invalid-link')
    expect(classifyManageError(new Error('network'))).toBe('error')
  })
})
