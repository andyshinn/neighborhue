import { act, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_EXAMPLE, type HeroExample } from '../lib/heroExample'
import { HomeCard } from './HomeCard'

const NOW = new Date('2026-08-01T12:00:00.000Z').getTime()

const live: HeroExample = {
  live: true,
  id: 'abc-123',
  name: 'Maple Street',
  hex: '#0080FF',
  colorName: 'Blue',
  paletteName: 'Rainbow',
  colors: [
    { hex: '#FF0000', name: 'Red' },
    { hex: '#0080FF', name: 'Blue' },
  ],
  rotationHour: 7,
  seconds: 3661,
  nextRotationAt: new Date(NOW + 3_661_000).toISOString(),
}

afterEach(() => {
  vi.useRealTimers()
})

describe('HomeCard', () => {
  it('renders the countdown from the server reading', () => {
    render(<HomeCard example={live} />)
    expect(screen.getByText('Next color in')).toBeInTheDocument()
    expect(screen.getByText('01:01:01')).toBeInTheDocument()
  })

  it('ticks down once a second', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    render(<HomeCard example={live} />)
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('01:00:59')).toBeInTheDocument()
  })

  // Issue #2: the countdown is the panel's headline and the palette is a label
  // beneath the rule, not the other way round.
  it('places the countdown above the palette name', () => {
    const { container } = render(<HomeCard example={live} />)
    const text = container.textContent ?? ''
    expect(text.indexOf('Next color in')).toBeLessThan(text.indexOf('Rainbow'))
    expect(text.indexOf('Rainbow')).toBeLessThan(text.indexOf('Rotates daily at'))
  })

  it('renders the palette swatches and the rotation hour', () => {
    render(<HomeCard example={live} />)
    expect(screen.getByText('Rainbow')).toBeInTheDocument()
    expect(screen.getByTitle('Red #FF0000')).toBeInTheDocument()
    expect(screen.getByText('Rotates daily at 7:00 AM')).toBeInTheDocument()
  })

  // The panel is painted slightly darker so white ink clears AA, but the value
  // the user reads must always be the real one.
  it('shows the true hex even though the panel is darkened for contrast', () => {
    render(<HomeCard example={live} />)
    const chip = screen.getByText('#0080FF')
    expect(chip).toBeInTheDocument()
    const panel = chip.closest('div')?.parentElement
    expect(panel).toHaveStyle({ color: '#ffffff' })
    expect(panel).not.toHaveStyle({ background: '#0080FF' })
  })

  it('uses the light-text lockup on a saturated mid-tone hue', () => {
    render(<HomeCard example={live} />)
    expect(screen.getByAltText('Neighborhue')).toHaveAttribute('src', '/lockup-light.png')
  })

  // The other branch of the ink rule: genuinely light hues keep their true
  // color and take dark ink, so the dark-text lockup has to come back.
  it('uses dark ink and the dark-text lockup on a light hue', () => {
    render(<HomeCard example={{ ...live, hex: '#FFEA00', colorName: 'Yellow' }} />)
    expect(screen.getByAltText('Neighborhue')).toHaveAttribute('src', '/lockup-dark-text.png')
    expect(screen.getByText('#FFEA00').closest('div')?.parentElement).toHaveStyle({
      color: '#181310',
      background: '#FFEA00',
    })
  })

  describe('fallback example', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(NOW)
    })

    // Hydration safety: the server has no reading and cannot know the reader's
    // zone, so it emits a placeholder that is the same width as HH:MM:SS.
    it('server-renders a placeholder of the same width as the real value', () => {
      const html = renderToString(<HomeCard example={FALLBACK_EXAMPLE} />)
      expect(html).toContain('--:--:--')
      expect('--:--:--').toHaveLength('01:01:01'.length)
    })

    it('counts toward the next local rotation hour once mounted', () => {
      render(<HomeCard example={FALLBACK_EXAMPLE} />)
      act(() => {
        vi.advanceTimersByTime(0)
      })
      expect(screen.queryByText('--:--:--')).not.toBeInTheDocument()
      expect(screen.getByText(/^\d{2}:\d{2}:\d{2}$/)).toBeInTheDocument()
    })
  })
})
