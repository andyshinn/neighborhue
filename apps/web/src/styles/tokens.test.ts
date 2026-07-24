import { describe, expect, it } from 'vitest'
import tokensCss from './tokens.css?raw'

const darkBlock = tokensCss.slice(tokensCss.indexOf('@media (prefers-color-scheme: dark)'))

describe('tokens.css', () => {
  it('imports the pink scale used by the how-it-works tiles', () => {
    expect(tokensCss).toContain('@import "@radix-ui/colors/pink.css";')
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
