import type { PublicColor } from '@neighborhue/api/types'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ColorField } from './ColorField'

const yellow: PublicColor = { hex: '#FFD700', rgb: [255, 215, 0], hsl: [51, 100, 50], name: 'Yellow' }

describe('ColorField', () => {
  it('renders the color name and hex (never color alone)', () => {
    render(<ColorField name="Maple Street" color={yellow} />)
    expect(screen.getByText('Yellow')).toBeInTheDocument()
    expect(screen.getByText('#FFD700')).toBeInTheDocument()
    expect(screen.getByText(/Maple Street/)).toBeInTheDocument()
  })

  it('applies the hue and computed ink as CSS variables', () => {
    const { container } = render(<ColorField name={null} color={yellow} />)
    const root = container.firstElementChild as HTMLElement
    expect(root.style.getPropertyValue('--hue')).toBe('#FFD700')
    expect(root.style.getPropertyValue('--ink')).toBe('#181310') // dark ink on yellow
  })
})
