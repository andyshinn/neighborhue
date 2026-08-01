import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { FALLBACK_EXAMPLE, type HeroExample } from '../lib/heroExample'
import { HomeView } from './HomeView'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, ...rest }: ComponentProps<'a'> & { to?: string; params?: Record<string, string> }) => (
    <a href={Object.entries(params ?? {}).reduce((path, [k, v]) => path.replace(`$${k}`, v), to ?? '')} {...rest}>
      {children}
    </a>
  ),
}))

const live: HeroExample = {
  ...FALLBACK_EXAMPLE,
  live: true,
  id: 'abc-123',
  seconds: 3661,
  nextRotationAt: new Date(Date.now() + 3_661_000).toISOString(),
}

describe('HomeView', () => {
  it('renders every section', () => {
    render(<HomeView example={live} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The whole neighborhood glows the same color.')
    expect(screen.getByRole('heading', { name: 'How it works' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Made for Home Assistant' })).toBeInTheDocument()
    expect(screen.getByText('A shared color for the whole neighborhood.')).toBeInTheDocument()
  })

  it('gives the nav a named lockup, Live example and Create', () => {
    render(<HomeView example={live} />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(screen.getByRole('link', { name: 'Neighborhue home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Live example' })).toHaveAttribute('href', '/n/abc-123')
    expect(screen.getByRole('link', { name: 'Create' })).toHaveAttribute('href', '/create')
    expect(nav.querySelectorAll('a')).toHaveLength(3)
  })

  it('drops the nav live-example link when no demo neighborhood is configured', () => {
    render(<HomeView example={FALLBACK_EXAMPLE} />)
    expect(screen.queryByRole('link', { name: /live example/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create' })).toBeInTheDocument()
  })

  // The #how anchor stays on the section even though the hero no longer spends
  // a button on it — the footer still links there.
  it('keeps the #how anchor on the how-it-works section', () => {
    const { container } = render(<HomeView example={live} />)
    expect(container.querySelector('#how')).toBeInTheDocument()
  })
})
