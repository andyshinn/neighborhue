import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HeroPalette } from '../lib/palette'
import { HomeHero } from './HomeHero'

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
  vi.useRealTimers()
})

// usePaletteCycle reads prefers-reduced-motion; happy-dom has no real media
// queries, so state it explicitly.
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

const palette: HeroPalette = {
  name: 'Rainbow Colors',
  colors: [
    { hex: '#FF0000', name: 'Red' },
    { hex: '#FF8000', name: 'Orange' },
    { hex: '#0080FF', name: 'Blue' },
  ],
}

describe('HomeHero', () => {
  it('renders the headline, both CTAs and the reassurance row', () => {
    stubReducedMotion(true)
    render(<HomeHero palette={palette} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The whole neighborhood glows the same color.')
    expect(screen.getByRole('link', { name: /create a neighborhood/i })).toHaveAttribute('href', '/create')
    expect(screen.getByRole('link', { name: /how it works/i })).toHaveAttribute('href', '#how')
    expect(screen.getByText('No accounts')).toBeInTheDocument()
    expect(screen.getByText('No logins')).toBeInTheDocument()
    expect(screen.getByText('About a minute to set up')).toBeInTheDocument()
  })

  // H4: Blue, not the palette's first color.
  it('rests on Rainbow blue', () => {
    stubReducedMotion(true)
    render(<HomeHero palette={palette} />)
    expect(screen.getByText('Blue')).toBeInTheDocument()
    expect(screen.queryByText('Red')).not.toBeInTheDocument()
  })

  it('falls back to the first color when the resting hex is absent', () => {
    stubReducedMotion(true)
    render(
      <HomeHero
        palette={{
          name: 'Warm',
          colors: [
            { hex: '#FF3B30', name: 'Scarlet' },
            { hex: '#12A150', name: 'Fern' },
          ],
        }}
      />,
    )
    expect(screen.getByText('Scarlet')).toBeInTheDocument()
    expect(screen.queryByText('Fern')).not.toBeInTheDocument()
  })

  it('cycles on its own, with no hover', () => {
    stubReducedMotion(false)
    vi.useFakeTimers()
    render(<HomeHero palette={palette} />)
    expect(screen.getByText('Blue')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    // Blue is index 2, so one tick past the resting offset wraps to Red.
    expect(screen.getByText('Red')).toBeInTheDocument()
  })

  // Use userEvent.hover, not a raw MouseEvent: React synthesizes onMouseEnter
  // from delegated mouseover/mouseout, so dispatching by hand is unreliable.
  // Reduced motion is stubbed on so the reel holds still and only the hover
  // moves the card.
  it('pins a hovered swatch and hands the card back on leave', async () => {
    stubReducedMotion(true)
    render(<HomeHero palette={palette} />)
    expect(screen.getByText('Blue')).toBeInTheDocument()

    const orange = screen.getByRole('button', { name: /Orange/ })
    await userEvent.hover(orange)
    expect(screen.getByText('Orange')).toBeInTheDocument()

    await userEvent.unhover(orange)
    expect(screen.getByText('Blue')).toBeInTheDocument()
  })

  it('renders the copy column without a card when no palette is available', () => {
    stubReducedMotion(true)
    render(<HomeHero palette={null} />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('figure')).not.toBeInTheDocument()
  })
})
