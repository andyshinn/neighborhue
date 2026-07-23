import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DeleteDialog } from './DeleteDialog'

describe('DeleteDialog', () => {
  it('opens on the trigger and confirms', async () => {
    const onConfirm = vi.fn()
    render(<DeleteDialog name="Maple Street" status="idle" onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete Maple Street?')).toBeInTheDocument()
    // The dialog's confirm button (there are two "Delete" — pick the one in the dialog)
    const confirm = screen.getByRole('button', { name: 'Delete neighborhood permanently' })
    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalled()
  })

  it('cancel closes without confirming', async () => {
    const onConfirm = vi.fn()
    render(<DeleteDialog name="Maple Street" status="idle" onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.queryByText('Delete Maple Street?')).not.toBeInTheDocument()
  })

  it('disables the confirm button while deleting', async () => {
    const onConfirm = vi.fn()
    render(<DeleteDialog name="Maple Street" status="deleting" onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const confirm = screen.getByRole('button', { name: 'Delete neighborhood permanently' })
    expect(confirm).toBeDisabled()
    expect(confirm).toHaveTextContent('Deleting…')
  })

  it('shows the error inside the dialog and keeps it open', async () => {
    const onConfirm = vi.fn()
    render(<DeleteDialog name="Maple Street" status="error" onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText(/Couldn.t delete/)).toBeInTheDocument()
    // the dialog is still open
    expect(screen.getByText('Delete Maple Street?')).toBeInTheDocument()
  })
})
