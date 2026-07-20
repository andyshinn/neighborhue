import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DetailsPanel } from './DetailsPanel'

const base = {
  name: 'Maple Street',
  neighborhoodId: 'abc-123',
  shareUrl: 'https://neighborhue.app/n/abc-123',
  seconds: 3661,
  hue: '#FFD700',
  ink: '#181310',
}

describe('DetailsPanel', () => {
  it('shows the neighborhood, a static Auto label, the countdown and the palette', () => {
    render(
      <DetailsPanel
        {...base}
        palette={{ kind: 'curated', name: 'Rainbow Colors', colors: [{ hex: '#FF0000', name: 'Red' }] }}
      />,
    )

    expect(screen.getByText('Maple Street')).toBeInTheDocument()
    expect(screen.getByText('01:01:01')).toBeInTheDocument()
    expect(screen.getByText('Rainbow Colors')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /1 palette colors/i })).toBeInTheDocument()

    // The Auto chip is a label, not a control (spec S5).
    const auto = screen.getByText('Auto')
    expect(auto.tagName).not.toBe('BUTTON')
    expect(auto).not.toHaveAttribute('tabindex')
  })

  it('labels custom-color neighborhoods and shows no swatches', () => {
    render(<DetailsPanel {...base} palette={{ kind: 'custom' }} />)
    expect(screen.getByText('Custom colors')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /palette colors/i })).not.toBeInTheDocument()
  })
})
