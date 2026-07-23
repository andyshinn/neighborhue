import type { ManageConfig, PublicNeighborhood } from '@neighborhue/api/types'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { PaletteSummary } from '../lib/palette'
import { ManageView } from './ManageView'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: ComponentProps<'a'> & { to?: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

const palettes: PaletteSummary[] = [
  {
    slug: 'rainbow',
    name: 'Rainbow Colors',
    description: 'The classic seven.',
    is_default: true,
    colors: [{ hex: '#FF0000', name: 'Red' }],
  },
  {
    slug: 'cool',
    name: 'Cool',
    description: 'Blues and teals.',
    is_default: false,
    colors: [{ hex: '#2E6BFF', name: 'Cornflower' }],
  },
]
const neighborhood = {
  id: 'abc',
  name: 'Maple Street',
  timezone: 'America/New_York',
  rotation_hour: 7,
  color: { hex: '#FF0000', rgb: [255, 0, 0], hsl: [0, 100, 50], name: 'Red' },
  rotated_at: '2026-07-21T07:00:00Z',
  next_rotation_at: '2026-07-22T07:00:00Z',
  seconds_until_rotation: 3600,
  palette: 'rainbow',
  day_index: 1,
} satisfies PublicNeighborhood

function setup(configOverride: Partial<ManageConfig> = {}, props: Partial<ComponentProps<typeof ManageView>> = {}) {
  const config: ManageConfig = {
    id: 'abc',
    name: 'Maple Street',
    timezone: 'America/New_York',
    rotation_hour: 7,
    palette: 'rainbow',
    custom_colors: null,
    ...configOverride,
  }
  const onSave = vi.fn()
  const onDelete = vi.fn()
  render(
    <ManageView
      id="abc"
      config={config}
      neighborhood={neighborhood}
      palettes={palettes}
      onSave={onSave}
      saveStatus="idle"
      onRetrySave={() => {}}
      onDelete={onDelete}
      deleteStatus="idle"
      {...props}
    />,
  )
  return { onSave, onDelete }
}

describe('ManageView', () => {
  it('seeds the name and saves it on blur', async () => {
    const { onSave } = setup()
    const name = screen.getByLabelText('Neighborhood name')
    expect(name).toHaveValue('Maple Street')
    await userEvent.clear(name)
    await userEvent.type(name, 'Oak Ave')
    await userEvent.tab() // blur
    expect(onSave).toHaveBeenCalledWith({ name: 'Oak Ave' })
  })

  it('saves a curated palette pick with custom_colors cleared', async () => {
    const { onSave } = setup()
    await userEvent.click(screen.getByRole('button', { name: /Cool/ }))
    expect(onSave).toHaveBeenCalledWith({ palette: 'cool', custom_colors: null })
  })

  it('opens Custom mode and saves the first added color with palette cleared', async () => {
    const { onSave } = setup()
    await userEvent.click(screen.getByRole('button', { name: /Custom colors/ }))
    // M2: selecting Custom with an empty list is transient — it must not save yet.
    expect(onSave).not.toHaveBeenCalled()
    await userEvent.type(screen.getByPlaceholderText('#FF6A00'), '#00FF00')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onSave).toHaveBeenCalledWith({ palette: null, custom_colors: [{ hex: '#00FF00', name: 'Custom' }] })
  })

  it('starts in Custom mode when config has custom_colors', () => {
    setup({ palette: null, custom_colors: [{ hex: '#FF3B30', name: 'Poppy' }] })
    expect(screen.getByText('Poppy')).toBeInTheDocument()
  })

  it('removing the last custom color saves custom_colors: null', async () => {
    const { onSave } = setup({ palette: null, custom_colors: [{ hex: '#FF3B30', name: 'Poppy' }] })
    await userEvent.click(screen.getByRole('button', { name: 'Remove Poppy' }))
    expect(onSave).toHaveBeenCalledWith({ custom_colors: null })
  })

  it('confirms delete', async () => {
    const { onDelete } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete neighborhood permanently' }))
    expect(onDelete).toHaveBeenCalled()
  })
})
