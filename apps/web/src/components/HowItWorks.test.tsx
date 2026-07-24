import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HowItWorks } from './HowItWorks'

describe('HowItWorks', () => {
  it('renders the three cards', () => {
    render(<HowItWorks />)
    expect(screen.getByRole('heading', { name: 'Pick a palette' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Share the link' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Point your lights' })).toBeInTheDocument()
  })

  // Both the hero's secondary CTA and the footer link scroll to #how.
  it('exposes the #how anchor target', () => {
    const { container } = render(<HowItWorks />)
    expect(container.querySelector('section#how')).not.toBeNull()
  })
})
