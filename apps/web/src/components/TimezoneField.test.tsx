import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TimezoneField } from './TimezoneField'

describe('TimezoneField', () => {
  it('says "Detected" when the value matches the detected zone', () => {
    render(<TimezoneField value="America/New_York" detectedZone="America/New_York" onChange={() => {}} />)
    expect(screen.getByText('Detected from your device.')).toBeInTheDocument()
  })

  it('says "Looks good." for a different valid zone', () => {
    render(<TimezoneField value="Europe/Paris" detectedZone="America/New_York" onChange={() => {}} />)
    expect(screen.getByText('Looks good.')).toBeInTheDocument()
  })

  it('shows the invalid hint for garbage', () => {
    render(<TimezoneField value="Mars/Base" detectedZone="America/New_York" onChange={() => {}} />)
    expect(screen.getByText('Use an IANA zone like America/New_York.')).toBeInTheDocument()
  })

  it('reports typing up through onChange', async () => {
    const onChange = vi.fn()
    render(<TimezoneField value="" detectedZone="UTC" onChange={onChange} />)
    await userEvent.type(screen.getByLabelText('Time zone'), 'U')
    expect(onChange).toHaveBeenCalledWith('U')
  })

  it('hides the valid-state hint when hideValidHint is set', () => {
    render(<TimezoneField value="America/New_York" detectedZone="America/New_York" onChange={() => {}} hideValidHint />)
    expect(screen.queryByText('Detected from your device.')).not.toBeInTheDocument()
    expect(screen.queryByText('Looks good.')).not.toBeInTheDocument()
  })

  it('still shows the invalid hint when hideValidHint is set', () => {
    render(<TimezoneField value="Mars/Base" detectedZone="America/New_York" onChange={() => {}} hideValidHint />)
    expect(screen.getByText('Use an IANA zone like America/New_York.')).toBeInTheDocument()
  })
})
