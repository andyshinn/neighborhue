import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Logo } from './Logo'

describe('Logo', () => {
  it('uses the light wordmark when the ink is light (dark background)', () => {
    render(<Logo lockup="light" />)
    expect(screen.getByAltText('Neighborhue')).toHaveAttribute('src', '/lockup-light.png')
  })
  it('uses the dark wordmark when the ink is dark (light background)', () => {
    render(<Logo lockup="dark-text" />)
    expect(screen.getByAltText('Neighborhue')).toHaveAttribute('src', '/lockup-dark-text.png')
  })
})
