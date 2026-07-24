import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), './src/styles/tokens.css'), 'utf8')
const darkBlock = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'))

describe('tokens.css', () => {
  it('imports the pink scale used by the how-it-works tiles', () => {
    expect(css).toContain('@import "@radix-ui/colors/pink.css";')
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
