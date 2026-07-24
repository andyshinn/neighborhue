import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HaBand } from './HaBand'

describe('HaBand', () => {
  it('describes the REST-sensor setup that actually ships', () => {
    render(<HaBand />)
    expect(screen.getByRole('heading', { name: 'Made for Home Assistant' })).toBeInTheDocument()
    expect(screen.getByText(/ready-made REST sensor and automation/i)).toBeInTheDocument()
  })

  // H6 is a deliberate omission: there is no setup page to link to yet, and the
  // handoff's target (Manage) is unreachable for a public visitor.
  it('renders no call to action', () => {
    render(<HaBand />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
