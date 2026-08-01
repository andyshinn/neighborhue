import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { FALLBACK_EXAMPLE, type HeroExample } from '../lib/heroExample'
import { HomeHero } from './HomeHero'

// The real Link builds its href from `to` plus `params`; the stub has to do the
// same or every /n/$id assertion would pass against a literal "$id".
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

describe('HomeHero', () => {
  it('renders the headline and the reassurance row', () => {
    render(<HomeHero example={live} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The whole neighborhood glows the same color.')
    expect(screen.getByText('No accounts')).toBeInTheDocument()
    expect(screen.getByText('No logins')).toBeInTheDocument()
    expect(screen.getByText('About a minute to set up')).toBeInTheDocument()
  })

  // Issue #6: the hero's second button goes to the product, not further down
  // the page. The #how anchor stays on the section itself.
  it('points the secondary CTA at the live neighborhood, not #how', () => {
    render(<HomeHero example={live} />)
    expect(screen.getByRole('link', { name: /create a neighborhood/i })).toHaveAttribute('href', '/create')
    expect(screen.getByRole('link', { name: /see a live example/i })).toHaveAttribute('href', '/n/abc-123')
    expect(screen.queryByRole('link', { name: /how it works/i })).not.toBeInTheDocument()
  })

  it('withholds the live-example CTA when no demo neighborhood is configured', () => {
    render(<HomeHero example={FALLBACK_EXAMPLE} />)
    expect(screen.getByRole('link', { name: /create a neighborhood/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /see a live example/i })).not.toBeInTheDocument()
  })

  it('paints the glow with the true hue, not the ink-adjusted panel color', () => {
    const { container } = render(<HomeHero example={live} />)
    const glows = container.querySelectorAll('[aria-hidden="true"][style*="background"]')
    expect(glows.length).toBe(2)
    for (const glow of glows) {
      expect(glow).toHaveStyle({ background: '#0080FF' })
    }
  })

  // The disclaimer exists precisely while the card is an illustration; once it
  // reads a real neighborhood there is nothing to disclaim.
  it('captions the card only while it is a fallback illustration', () => {
    const { rerender } = render(<HomeHero example={FALLBACK_EXAMPLE} />)
    expect(screen.getByText("Example of a neighborhood's daily color card.")).toBeInTheDocument()

    rerender(<HomeHero example={live} />)
    expect(screen.queryByText("Example of a neighborhood's daily color card.")).not.toBeInTheDocument()
  })
})
