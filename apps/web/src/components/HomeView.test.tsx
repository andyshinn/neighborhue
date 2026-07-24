import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HeroPalette } from '../lib/palette'
import { HomeView } from './HomeView'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: ComponentProps<'a'> & { to?: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

const original = window.matchMedia

afterEach(() => {
  window.matchMedia = original
})

function stubReducedMotion(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

const palette: HeroPalette = { name: 'Rainbow Colors', colors: [{ hex: '#0080FF', name: 'Blue' }] }

describe('HomeView', () => {
  it('renders every section', () => {
    stubReducedMotion(true)
    render(<HomeView palette={palette} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The whole neighborhood glows the same color.')
    expect(screen.getByRole('heading', { name: 'How it works' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Made for Home Assistant' })).toBeInTheDocument()
    expect(screen.getByText('A shared color for the whole neighborhood.')).toBeInTheDocument()
  })

  it('offers Create in the nav', () => {
    stubReducedMotion(true)
    render(<HomeView palette={palette} />)
    expect(screen.getByRole('link', { name: 'Create' })).toHaveAttribute('href', '/create')
  })

  // H2: with no example neighborhood, a "Live example" link could only point at
  // /create, which would be a lie.
  it('has no live-example link', () => {
    stubReducedMotion(true)
    render(<HomeView palette={palette} />)
    expect(screen.queryByRole('link', { name: /live example/i })).not.toBeInTheDocument()
  })
})
