import type { CreatedNeighborhood } from '@neighborhue/api/types'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { PaletteSummary } from '../lib/palette'
import { CreateView } from './CreateView'

vi.mock('../hooks/usePaletteCycle', () => ({ usePaletteCycle: () => 0 }))
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
    colors: [{ hex: '#FF2D2D', name: 'Scarlet' }],
  },
  {
    slug: 'cool',
    name: 'Cool',
    description: 'Blues and teals.',
    is_default: false,
    colors: [{ hex: '#2E6BFF', name: 'Cornflower' }],
  },
]

function setup(overrides: Partial<ComponentProps<typeof CreateView>> = {}) {
  const onCreate = vi.fn()
  render(
    <CreateView
      palettes={palettes}
      initialTimezone="America/New_York"
      onCreate={onCreate}
      pending={false}
      error={null}
      created={null}
      {...overrides}
    />,
  )
  return { onCreate }
}

describe('CreateView', () => {
  it('submits the assembled body with the default palette', async () => {
    const { onCreate } = setup()
    await userEvent.type(screen.getByLabelText(/Neighborhood name/), 'Maple Street')
    await userEvent.click(screen.getByRole('button', { name: /Create neighborhood/ }))
    expect(onCreate).toHaveBeenCalledWith({
      name: 'Maple Street',
      timezone: 'America/New_York',
      rotation_hour: 7,
      palette: 'rainbow',
    })
  })

  it('omits palette when Custom is selected', async () => {
    const { onCreate } = setup()
    await userEvent.click(screen.getByRole('button', { name: /Custom colors/ }))
    await userEvent.click(screen.getByRole('button', { name: /Create neighborhood/ }))
    expect(onCreate).toHaveBeenCalledWith({ timezone: 'America/New_York', rotation_hour: 7 })
  })

  it('disables submit on an invalid timezone', async () => {
    setup()
    const tz = screen.getByLabelText('Time zone')
    await userEvent.clear(tz)
    await userEvent.type(tz, 'Mars/Base')
    expect(screen.getByRole('button', { name: /Create neighborhood/ })).toBeDisabled()
  })

  it('shows the error message and keeps the form', () => {
    setup({ error: 'Something went wrong' })
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByLabelText(/Neighborhood name/)).toBeInTheDocument()
  })

  it('renders the success card instead of the form once created', () => {
    const created: CreatedNeighborhood = {
      id: 'abc123',
      admin_secret: 'nh_sk_secret',
      manage_url: 'https://neighborhue.app/manage/abc123#nh_sk_secret',
      name: 'Maple Street',
      timezone: 'America/New_York',
      rotation_hour: 7,
      palette: 'rainbow',
      custom_colors: null,
    }
    setup({ created })
    expect(screen.getByText('Your neighborhood is live')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Neighborhood name/)).not.toBeInTheDocument()
  })
})
