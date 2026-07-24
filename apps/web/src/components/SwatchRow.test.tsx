import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SwatchRow } from './SwatchRow'

const colors = [
  { hex: '#FF0000', name: 'Red' },
  { hex: '#0080FF', name: 'Blue' },
]

describe('SwatchRow', () => {
  it('renders one swatch per color with an accessible group label', () => {
    render(<SwatchRow colors={colors} />)
    const group = screen.getByRole('img', { name: /2 palette colors/i })
    expect(group).toBeInTheDocument()
    expect(group.children).toHaveLength(2)
  })

  it('renders nothing when there are no colors (custom-color neighborhoods)', () => {
    const { container } = render(<SwatchRow colors={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('marks the active swatch, matching hex case-insensitively', () => {
    render(<SwatchRow colors={colors} activeHex="#0080ff" />)
    const group = screen.getByRole('img', { name: /2 palette colors/i })
    const active = Array.from(group.children).filter((el) => el.getAttribute('data-active') === 'true')
    expect(active).toHaveLength(1)
    expect(active[0]).toHaveStyle({ background: '#0080FF' })
  })

  // Regression guard (spec H11): Manage's preview passes no activeHex and must
  // keep rendering a plain, unhighlighted row.
  it('marks nothing active when no activeHex is given', () => {
    render(<SwatchRow colors={colors} />)
    const group = screen.getByRole('img', { name: /2 palette colors/i })
    expect(Array.from(group.children).some((el) => el.hasAttribute('data-active'))).toBe(false)
  })
})
