import type { PublicColor } from '@neighborhue/api/types'
import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ShareColorField } from './ShareColorField'

// ShareColorField renders @tanstack/react-router's <Link> for the home link.
// Link calls useRouter() internally, which returns null (then throws on
// `.isServer`) without a <RouterProvider> ancestor. These are unit tests for
// the panel's own rendering/CSS-var behavior, not end-to-end routing, so
// Link is stubbed to a plain anchor for this file only.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: ComponentProps<'a'> & { to?: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

const yellow: PublicColor = { hex: '#FFD700', rgb: [255, 215, 0], hsl: [51, 100, 50], name: 'Yellow' }
const indigo: PublicColor = { hex: '#4B0082', rgb: [75, 0, 130], hsl: [275, 100, 25], name: 'Indigo' }

describe('ShareColorField', () => {
  it('always shows the color name and hex, never color alone', () => {
    render(<ShareColorField name="Maple Street" color={yellow} paletteName="Rainbow Colors" />)
    expect(screen.getByText('Yellow')).toBeInTheDocument()
    expect(screen.getByText('#FFD700')).toBeInTheDocument()
    expect(screen.getByText(/Maple Street/)).toBeInTheDocument()
    expect(screen.getByText(/Rainbow Colors/)).toBeInTheDocument()
  })

  it('applies the hue and computed ink as CSS variables', () => {
    const { container } = render(<ShareColorField name={null} color={yellow} paletteName="Rainbow Colors" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.style.getPropertyValue('--hue')).toBe('#FFD700')
    expect(root.style.getPropertyValue('--ink')).toBe('#181310')
  })

  it('swaps to the light lockup on a dark hue', () => {
    render(<ShareColorField name={null} color={indigo} paletteName="Cool" />)
    expect(screen.getByAltText('Neighborhue')).toHaveAttribute('src', '/lockup-light.png')
  })

  it('falls back to the product name when the neighborhood is unnamed', () => {
    render(<ShareColorField name={null} color={yellow} paletteName="Rainbow Colors" />)
    expect(screen.getByText(/Neighborhue · Today/)).toBeInTheDocument()
  })
})
