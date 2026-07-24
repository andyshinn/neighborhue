import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SiteLogo } from './SiteLogo'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: ComponentProps<'a'> & { to?: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

describe('SiteLogo', () => {
  it('links home by default', () => {
    render(<SiteLogo />)
    expect(screen.getByRole('link', { name: 'Neighborhue home' })).toHaveAttribute('href', '/')
  })

  it('renders a non-interactive mark when asLink is false', () => {
    render(<SiteLogo size="footer" asLink={false} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Neighborhue' })).toBeInTheDocument()
  })
})
