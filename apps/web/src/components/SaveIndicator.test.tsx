import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SaveIndicator } from './SaveIndicator'

describe('SaveIndicator', () => {
  it('renders nothing when idle', () => {
    const { container } = render(<SaveIndicator status="idle" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows Saving and Saved', () => {
    const { rerender } = render(<SaveIndicator status="saving" />)
    expect(screen.getByText('Saving…')).toBeInTheDocument()
    rerender(<SaveIndicator status="saved" />)
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('offers retry on error', async () => {
    const onRetry = vi.fn()
    render(<SaveIndicator status="error" onRetry={onRetry} />)
    expect(screen.getByText(/Couldn.t save/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalled()
  })
})
