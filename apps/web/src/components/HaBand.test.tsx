import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HaBand } from './HaBand'

describe('HaBand', () => {
  it('makes one short promise instead of inlining YAML', () => {
    render(<HaBand />)
    expect(screen.getByRole('heading', { name: 'Made for Home Assistant' })).toBeInTheDocument()
    expect(screen.getByText(/Install the Neighborhue integration from HACS/i)).toBeInTheDocument()
    // The snippet belongs on the setup page; a marketing band that prints a
    // config file is documentation wearing marketing's clothes.
    expect(screen.queryByText(/configuration\.yaml/i)).not.toBeInTheDocument()
  })

  it('sends the reader somewhere', () => {
    render(<HaBand />)
    const cta = screen.getByRole('link', { name: /see the setup/i })
    expect(cta).toHaveAttribute('href', 'https://github.com/andyshinn/neighborhue#home-assistant')
    expect(cta).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
