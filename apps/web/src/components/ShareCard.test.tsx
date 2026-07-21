import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PaletteColor } from '../lib/palette'
import { ShareCard } from './ShareCard'

const colors: PaletteColor[] = [
  { hex: '#FF2D2D', name: 'Scarlet' },
  { hex: '#2E6BFF', name: 'Cornflower' },
]

describe('ShareCard', () => {
  it('renders the active color name and rotation label', () => {
    render(
      <ShareCard
        name="Maple Street"
        activeColor={colors[0]}
        colors={colors}
        paletteName="Rainbow Colors"
        rotationLabel="7:00 AM"
      />,
    )
    expect(screen.getByText('Scarlet')).toBeInTheDocument()
    expect(screen.getByText(/Maple Street · today/)).toBeInTheDocument()
    expect(screen.getByText('Rotates daily at 7:00 AM')).toBeInTheDocument()
  })

  it('fires onPreviewColor on hover and marks the active swatch', async () => {
    const onPreviewColor = vi.fn()
    render(
      <ShareCard
        name={null}
        activeColor={colors[1]}
        colors={colors}
        paletteName="Rainbow Colors"
        rotationLabel="7:00 AM"
        activeHex="#2E6BFF"
        onPreviewColor={onPreviewColor}
      />,
    )
    expect(screen.getByRole('button', { name: /Cornflower/ })).toHaveAttribute('data-active', 'true')
    await userEvent.hover(screen.getByRole('button', { name: /Scarlet/ }))
    expect(onPreviewColor).toHaveBeenCalledWith('#FF2D2D')
  })

  it('is static (no buttons) without onPreviewColor', () => {
    render(
      <ShareCard name={null} activeColor={colors[0]} colors={colors} paletteName="Rainbow Colors" rotationLabel="7:00 AM" />,
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows the custom placeholder when there is no active color', () => {
    render(<ShareCard name="Maple" activeColor={null} colors={[]} paletteName="Custom colors" rotationLabel="7:00 AM" />)
    expect(screen.getByText('Your custom colors')).toBeInTheDocument()
  })
})
