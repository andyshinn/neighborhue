import { describe, expect, it } from 'vitest'
import tokensCss from './tokens.css?raw'

const darkBlock = tokensCss.slice(tokensCss.indexOf('@media (prefers-color-scheme: dark)'))

describe('tokens.css', () => {
  it('imports the pink scale used by the how-it-works tiles', () => {
    expect(tokensCss).toContain('@import "@radix-ui/colors/pink.css";')
  })

  it('imports the orange scale used by the sun tile', () => {
    expect(tokensCss).toContain('@import "@radix-ui/colors/orange.css";')
  })

  // The dark theme's whole problem was coldness: Sand's dark ramp is nearly
  // neutral (#111110), so surfaces run on Radix Bronze instead. If these
  // re-point back to Sand, dark mode is generic black-on-charcoal again.
  it.each([
    ['--page-bg', 'var(--bronze-1)'],
    ['--surface', 'var(--bronze-2)'],
    ['--surface-2', 'var(--bronze-3)'],
    ['--hairline', 'var(--bronze-a3)'],
    ['--border-strong', 'var(--bronze-a4)'],
  ])('paints %s from the warm Bronze ramp in dark mode', (token, value) => {
    expect(darkBlock).toContain(`${token}: ${value};`)
  })

  it.each([
    ['--bronze-1', '#141110'],
    ['--bronze-2', '#1c1917'],
    ['--bronze-3', '#262220'],
    ['--bronze-a3', '#faceb817'],
    ['--bronze-a4', '#facdb622'],
  ])('re-declares %s in the dark block', (token, value) => {
    expect(darkBlock).toContain(`${token}: ${value};`)
  })

  // Links are text, not fills. --accent must stay on the solid step (it still
  // paints selected rings and check discs) while --link moves to the text step,
  // because solid indigo #3e63dd on a near-black page is under 3:1.
  it('moves links to the text step in dark without moving --accent', () => {
    expect(darkBlock).toContain('--link: var(--indigo-11);')
    expect(darkBlock).not.toContain('--accent: var(--indigo-11);')
  })

  it.each([
    ['--indigo-3', '#182449'],
    ['--indigo-11', '#9eb1ff'],
    ['--pink-3', '#37172f'],
    ['--pink-11', '#ff8dcc'],
    ['--amber-3', '#302008'],
    ['--amber-11', '#ffca16'],
  ])('re-declares %s in the dark block', (token, value) => {
    expect(darkBlock).toContain(`${token}: ${value};`)
  })
})
