import type { CreatedNeighborhood } from '@neighborhue/api/types'
import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CreateSuccess } from './CreateSuccess'

// Rich Link mock: interpolate params and append the hash so we can assert real URLs.
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    hash,
    ...rest
  }: ComponentProps<'a'> & { to?: string; params?: Record<string, string>; hash?: string }) => {
    let href = to ?? ''
    if (params) for (const [k, v] of Object.entries(params)) href = href.replace(`$${k}`, v)
    if (hash) href += `#${hash}`
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    )
  },
}))

const created: CreatedNeighborhood = {
  id: 'abc123',
  admin_secret: 'nh_sk_secret',
  manage_url: 'https://neighborhue.app/manage/abc123#nh_sk_secret',
  name: 'Maple Street',
  timezone: 'America/New_York',
  rotation_hour: 7,
  palette: 'rainbow',
  custom_colors: null,
}

describe('CreateSuccess', () => {
  it('shows the headline and warning', () => {
    render(<CreateSuccess created={created} />)
    expect(screen.getByText('Your neighborhood is live')).toBeInTheDocument()
    expect(
      screen.getByText(
        "Save this link — it's the only way back in. There are no accounts, and it can't be recovered if lost.",
      ),
    ).toBeInTheDocument()
  })

  it('links the CTAs to the share and manage URLs', () => {
    render(<CreateSuccess created={created} />)
    expect(screen.getByRole('link', { name: /Open share page/ })).toHaveAttribute('href', '/n/abc123')
    expect(screen.getByRole('link', { name: /Go to manage/ })).toHaveAttribute('href', '/manage/abc123#nh_sk_secret')
  })
})
