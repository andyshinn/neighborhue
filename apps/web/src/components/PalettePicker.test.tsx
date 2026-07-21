import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PaletteSummary } from '../lib/palette'
import { PalettePicker } from './PalettePicker'

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

describe('PalettePicker', () => {
  it('lists palette names and reports a selection', async () => {
    const onSelect = vi.fn()
    render(<PalettePicker palettes={palettes} selectedSlug="rainbow" onSelect={onSelect} />)
    expect(screen.getByText('Rainbow Colors')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Cool/ }))
    expect(onSelect).toHaveBeenCalledWith('cool')
  })

  it('selects Custom (null) and reveals the note', async () => {
    const onSelect = vi.fn()
    const { rerender } = render(<PalettePicker palettes={palettes} selectedSlug="rainbow" onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: /Custom colors/ }))
    expect(onSelect).toHaveBeenCalledWith(null)
    rerender(<PalettePicker palettes={palettes} selectedSlug={null} onSelect={onSelect} />)
    expect(
      screen.getByText("Create the neighborhood first — you'll add and reorder your custom colors in Manage."),
    ).toBeInTheDocument()
  })

  it('marks the selected row', () => {
    render(<PalettePicker palettes={palettes} selectedSlug="rainbow" onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: /Rainbow Colors/ })).toHaveAttribute('aria-pressed', 'true')
  })
})
