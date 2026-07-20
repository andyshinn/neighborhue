import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CopyButton } from './CopyButton'

// @testing-library/user-event's setup() unconditionally installs its own
// navigator.clipboard stub (attachClipboardStubToView, called from
// setupMain), overwriting any prior mock installed on navigator.clipboard.
// So setup() must run BEFORE we mock, and the mock patches the stub's
// writeText method directly rather than replacing navigator.clipboard itself
// (which happy-dom@20 exposes as a getter-only accessor anyway).
function mockClipboard(impl: () => Promise<void>) {
  navigator.clipboard.writeText = vi.fn(impl)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CopyButton', () => {
  it('writes the value to the clipboard and confirms', async () => {
    const user = userEvent.setup()
    mockClipboard(() => Promise.resolve())
    render(<CopyButton value="https://neighborhue.app/n/abc" label="Copy share link" />)

    await user.click(screen.getByRole('button', { name: /copy share link/i }))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://neighborhue.app/n/abc')
    expect(await screen.findByText('Copied!')).toBeInTheDocument()
  })

  it('falls back to a manual-copy hint when the clipboard is unavailable', async () => {
    // Rejects in insecure contexts and under some permission setups.
    const user = userEvent.setup()
    mockClipboard(() => Promise.reject(new Error('denied')))
    render(<CopyButton value="x" label="Copy share link" />)

    await user.click(screen.getByRole('button', { name: /copy share link/i }))

    expect(await screen.findByText(/press ⌘c/i)).toBeInTheDocument()
  })
})
