import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HaPanel } from './HaPanel'

describe('HaPanel', () => {
  it('is collapsed by default and reveals the id and YAML when opened', async () => {
    const user = userEvent.setup()
    render(<HaPanel neighborhoodId="abc-123" />)

    expect(screen.queryByText(/platform: rest/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /add to home assistant/i }))

    expect(screen.getByText('abc-123')).toBeInTheDocument()
    expect(screen.getByText(/platform: rest/)).toBeInTheDocument()
    // The snippet must target this neighborhood's endpoint.
    expect(screen.getByText(/v1\/neighborhoods\/abc-123/)).toBeInTheDocument()
  })
})
