import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SiteFooter } from './SiteFooter'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: ComponentProps<'a'> & { to?: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

describe('SiteFooter', () => {
  it('links to the how-it-works anchor and the repo', () => {
    render(<SiteFooter />)
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '#how')
    const gh = screen.getByRole('link', { name: 'GitHub' })
    expect(gh).toHaveAttribute('href', 'https://github.com/andyshinn/neighborhue')
    expect(gh).toHaveAttribute('target', '_blank')
    expect(gh).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('discloses the privacy statement on demand', async () => {
    const user = userEvent.setup()
    render(<SiteFooter />)
    expect(screen.queryByText(/no tracking or analytics/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Privacy' }))
    expect(screen.getByText(/no tracking or analytics/i)).toBeInTheDocument()
  })
})
