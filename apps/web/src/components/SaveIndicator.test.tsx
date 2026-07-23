import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SaveIndicator } from './SaveIndicator'

describe('SaveIndicator', () => {
  it('renders no status text when idle, but keeps the live region mounted', () => {
    const { container } = render(<SaveIndicator status="idle" />)
    expect(screen.queryByText(/Saving|Saved|Couldn't save/i)).not.toBeInTheDocument()
    // The live region must stay in the DOM so the first save is announced.
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument()
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
