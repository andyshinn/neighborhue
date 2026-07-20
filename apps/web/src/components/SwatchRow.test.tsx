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
})
