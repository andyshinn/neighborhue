import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RotationHourStepper } from './RotationHourStepper'

describe('RotationHourStepper', () => {
  it('shows the 12-hour label', () => {
    render(<RotationHourStepper hour={7} onChange={() => {}} />)
    expect(screen.getByText('7:00 AM')).toBeInTheDocument()
  })

  it('wraps forward from 23 to 0', async () => {
    const onChange = vi.fn()
    render(<RotationHourStepper hour={23} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /later/i }))
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('wraps backward from 0 to 23', async () => {
    const onChange = vi.fn()
    render(<RotationHourStepper hour={0} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /earlier/i }))
    expect(onChange).toHaveBeenCalledWith(23)
  })
})
