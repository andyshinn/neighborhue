import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CustomColorsEditor } from './CustomColorsEditor'

const two = [
  { hex: '#FF3B30', name: 'Poppy' },
  { hex: '#2E6BFF', name: 'Cobalt' },
]

describe('CustomColorsEditor', () => {
  it('shows the empty state when there are no colors', () => {
    render(<CustomColorsEditor colors={[]} onChange={() => {}} />)
    expect(screen.getByText('No custom colors yet')).toBeInTheDocument()
  })

  it('adds a valid color (name defaults to Custom when blank)', async () => {
    const onChange = vi.fn()
    render(<CustomColorsEditor colors={[]} onChange={onChange} />)
    await userEvent.type(screen.getByPlaceholderText('#FF6A00'), '#00FF00')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onChange).toHaveBeenCalledWith([{ hex: '#00FF00', name: 'Custom' }])
  })

  it('rejects an invalid hex and does not add', async () => {
    const onChange = vi.fn()
    render(<CustomColorsEditor colors={[]} onChange={onChange} />)
    await userEvent.type(screen.getByPlaceholderText('#FF6A00'), '#F60')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('Enter a valid hex like #FF6A00.')).toBeInTheDocument()
  })

  it('removes a color', async () => {
    const onChange = vi.fn()
    render(<CustomColorsEditor colors={two} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Remove Poppy' }))
    expect(onChange).toHaveBeenCalledWith([{ hex: '#2E6BFF', name: 'Cobalt' }])
  })

  it('reorders down, and top-up / bottom-down are no-ops', async () => {
    const onChange = vi.fn()
    render(<CustomColorsEditor colors={two} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Move Poppy down' }))
    expect(onChange).toHaveBeenCalledWith([
      { hex: '#2E6BFF', name: 'Cobalt' },
      { hex: '#FF3B30', name: 'Poppy' },
    ])
    onChange.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Move Poppy up' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
