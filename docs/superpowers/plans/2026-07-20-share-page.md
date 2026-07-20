# Share Page (Spec 2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the foundation's minimal `/n/:id` walking skeleton with the complete Share page — the full-bleed two-panel design neighbors open from a group-chat link.

**Architecture:** The route is the only unit that touches data: it fetches the neighborhood and the palette list in parallel (both SSR'd, both priming the TanStack Query cache), resolves the palette by slug, and hands plain values to props-driven components. All logic with real behaviour (countdown formatting, palette resolution, the ticking hook) lives in pure functions/hooks that unit-test without a DOM.

**Tech Stack:** TanStack Start/Router/Query, React 19, Radix Primitives (`Collapsible`) + Radix Icons, CSS Modules over the foundation's semantic token layer, Vitest + Testing Library + happy-dom.

**Source of truth:** [spec](../specs/2026-07-20-share-page-design.md) (decisions S1–S15) and [handoff §3](../../handoff/neighborhue/design_handoff_neighborhue/README.md). Where the handoff and the live API disagree on palette data, **the API wins**.

## Global Constraints

Copied from the spec; every task implicitly includes these.

- **Scope is the Share page only.** No Share Card component, no Palette Picker, no marketing content, no custom-colors editor — those are Specs 2b/2c/2d. Do not build them.
- **The countdown ticks from the absolute `next_rotation_at`, NEVER `seconds_until_rotation`** (S6). The API sets `Cache-Control: max-age={seconds_until_rotation}`, so a cached response carries a stale relative value; the absolute timestamp is immune.
- **First client render uses the SSR-computed seed; ticking starts after mount** (S7), so hydration matches byte-for-byte.
- **The countdown is NOT an `aria-live` region** (S11) — it updates every second and would flood a screen reader.
- **Focus rings use `outline: 2px solid var(--ink)`** (S10) so they contrast against any daily hue.
- **`prefers-reduced-motion: reduce` disables the cross-fade; the countdown keeps ticking** (S9) — it is information, not decoration.
- **Hex and name are always rendered** — meaning never depends on color alone (binding foundation constraint).
- **The "Auto" chip is a static label** — not a button, not focusable (S5).
- **Never replicate the API's color *selection* client-side** (foundation W10). The API returns the color; only the ink derivation is local.
- **`apps/web` imports types only from `@neighborhue/api`** — a runtime import would drag untranspiled TS into Vite's graph.
- **No API changes** in this plan (S2/S3/S4 were each resolved without one).
- **HA panel ships the YAML + UUID only — no blueprint button** (S2).
- **Palette comes from a second fetch**; a `null` slug renders "Custom colors" with no swatch row (S3).
- **Styling is CSS Modules + CSS custom properties** over the existing semantic tokens (`--page-bg`, `--surface`, `--surface-2`, `--text`, `--text-muted`, `--text-faint`, `--hairline`, `--accent`, `--cta-bg`, `--cta-fg`, `--shadow-card`, `--font-sans`, `--font-mono`). Radix **Primitives, not Themes**.
- Repo conventions: **pnpm**, **Biome** (`pnpm check:fix`), work on `main`, commit trailer verbatim:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure

**Create** (all under `apps/web/`):

| Path | Responsibility |
|---|---|
| `src/lib/config.ts` | `API_URL` constant, shared by queries + HaPanel |
| `src/lib/countdown.ts` / `.test.ts` | `formatCountdown(seconds)` — pure |
| `src/lib/palette.ts` / `.test.ts` | `resolvePalette(slug, palettes)` — pure |
| `src/hooks/useCountdown.ts` / `.test.ts` | Seed → tick from absolute timestamp → expire |
| `src/components/CopyButton.tsx` / `.module.css` / `.test.tsx` | Clipboard + label swap + rejection fallback |
| `src/components/Logo.tsx` | Lockup chosen from the computed ink |
| `src/components/SwatchRow.tsx` / `.module.css` / `.test.tsx` | Palette swatch run |
| `src/components/Countdown.tsx` / `.module.css` | Presentational `HH:MM:SS` |
| `src/components/HaPanel.tsx` / `.module.css` / `.test.tsx` | Radix Collapsible: UUID + YAML |
| `src/components/ShareColorField.tsx` / `.module.css` / `.test.tsx` | The hue panel (evolves `ColorField`) |
| `src/components/DetailsPanel.tsx` / `.module.css` / `.test.tsx` | The neutral panel |
| `src/routes/n.$id.module.css` | Two-panel page layout |
| `public/lockup-dark-text.png`, `public/lockup-light.png`, `public/logo-icon.png` | Committed assets (S12) |

**Modify:** `src/routes/n.$id.tsx` (layout + parallel loader + rollover), `src/lib/queries.ts` (add `palettesQueryOptions`, use `config.ts`), `src/styles/reset.css` (add `.sr-only`, global focus ring), `package.json` (add `@radix-ui/react-collapsible`).

**Delete:** `src/components/ColorField.tsx` + `ColorField.test.tsx` (superseded by `ShareColorField`, S13).

---

## Task 1: Pure logic — countdown formatting + palette resolution

Two pure functions with no UI, tested first because every later task depends on them.

**Files:**
- Create: `apps/web/src/lib/countdown.ts`, `apps/web/src/lib/countdown.test.ts`
- Create: `apps/web/src/lib/palette.ts`, `apps/web/src/lib/palette.test.ts`

**Interfaces:**
- Produces: `formatCountdown(seconds: number): string` → zero-padded `"HH:MM:SS"`, clamped at 0.
- Produces: `type PaletteColor = { hex: string; name: string }`
- Produces: `type PaletteSummary = { slug: string; name: string; description: string; colors: PaletteColor[] }`
- Produces: `type ResolvedPalette = { kind: 'curated'; name: string; colors: PaletteColor[] } | { kind: 'custom' }`
- Produces: `resolvePalette(slug: string | null, palettes: PaletteSummary[]): ResolvedPalette`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/lib/countdown.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatCountdown } from './countdown'

describe('formatCountdown', () => {
  it('zero-pads hours, minutes and seconds', () => {
    expect(formatCountdown(0)).toBe('00:00:00')
    expect(formatCountdown(61)).toBe('00:01:01')
    expect(formatCountdown(3661)).toBe('01:01:01')
    expect(formatCountdown(86399)).toBe('23:59:59')
  })
  it('clamps negatives to zero (client clock ahead of the server)', () => {
    expect(formatCountdown(-5)).toBe('00:00:00')
  })
  it('does not wrap past 24 hours', () => {
    expect(formatCountdown(90000)).toBe('25:00:00')
  })
  it('floors fractional seconds', () => {
    expect(formatCountdown(59.9)).toBe('00:00:59')
  })
})
```

Create `apps/web/src/lib/palette.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { type PaletteSummary, resolvePalette } from './palette'

const palettes: PaletteSummary[] = [
  {
    slug: 'rainbow',
    name: 'Rainbow Colors',
    description: 'The classic seven-color rainbow.',
    colors: [
      { hex: '#FF0000', name: 'Red' },
      { hex: '#0080FF', name: 'Blue' },
    ],
  },
]

describe('resolvePalette', () => {
  it('resolves a known slug to its display name and colors', () => {
    const r = resolvePalette('rainbow', palettes)
    expect(r).toEqual({ kind: 'curated', name: 'Rainbow Colors', colors: palettes[0].colors })
  })
  it('treats a null slug as custom colors (no swatches available publicly)', () => {
    expect(resolvePalette(null, palettes)).toEqual({ kind: 'custom' })
  })
  it('degrades gracefully for an unknown slug: shows the slug, no swatches', () => {
    // Happens if the API adds a palette while our cached list is stale.
    expect(resolvePalette('brand-new', palettes)).toEqual({ kind: 'curated', name: 'brand-new', colors: [] })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm -F @neighborhue/web test`
Expected: FAIL — `./countdown` and `./palette` do not exist.

- [ ] **Step 3: Implement both**

Create `apps/web/src/lib/countdown.ts`:

```ts
// Renders a remaining-seconds count as HH:MM:SS. Clamped at zero because the
// client clock can run ahead of the server's rotation moment (spec S8).
export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
}
```

Create `apps/web/src/lib/palette.ts`:

```ts
export interface PaletteColor {
  hex: string
  name: string
}

export interface PaletteSummary {
  slug: string
  name: string
  description: string
  colors: PaletteColor[]
}

export type ResolvedPalette =
  | { kind: 'curated'; name: string; colors: PaletteColor[] }
  | { kind: 'custom' }

// The public read returns only a palette SLUG, so the display name and swatch
// colors come from GET /v1/palettes (spec S3). A null slug means the
// neighborhood is on custom colors, which the public endpoint does not expose —
// so there are no swatches to show.
export function resolvePalette(slug: string | null, palettes: PaletteSummary[]): ResolvedPalette {
  if (!slug) return { kind: 'custom' }
  const found = palettes.find((p) => p.slug === slug)
  if (!found) return { kind: 'curated', name: slug, colors: [] }
  return { kind: 'curated', name: found.name, colors: found.colors }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm -F @neighborhue/web test`
Expected: PASS (all countdown + palette tests green; the existing 13 foundation tests stay green).

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check:fix
git add apps/web/src/lib/countdown.ts apps/web/src/lib/countdown.test.ts apps/web/src/lib/palette.ts apps/web/src/lib/palette.test.ts
git commit -m "feat(web): countdown formatting + palette resolution

Two pure units the Share page is built on: HH:MM:SS formatting clamped
at zero, and slug -> display name + swatch colors resolution with a
graceful fallback for an unknown slug.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `useCountdown` — seed, tick from the absolute timestamp, expire

The load-bearing hook. It must tick from `next_rotation_at` (absolute) and use the SSR seed for the first render (S6/S7).

**Files:**
- Create: `apps/web/src/hooks/useCountdown.ts`, `apps/web/src/hooks/useCountdown.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `useCountdown(seedSeconds: number, nextRotationAt: string, onExpire: () => void): number` — returns remaining whole seconds, clamped at 0.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/hooks/useCountdown.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCountdown } from './useCountdown'

// Fixed "now" so the absolute-timestamp math is deterministic.
const NOW = new Date('2026-07-20T12:00:00.000Z').getTime()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useCountdown', () => {
  it('returns the SSR seed on the first render (hydration must match)', () => {
    const target = new Date(NOW + 500_000).toISOString()
    const { result } = renderHook(() => useCountdown(12345, target, () => {}))
    expect(result.current).toBe(12345)
  })

  it('recomputes from the absolute timestamp after mount, ignoring a stale seed', () => {
    const target = new Date(NOW + 60_000).toISOString() // 60s away
    const { result } = renderHook(() => useCountdown(99999, target, () => {}))
    act(() => {
      vi.advanceTimersByTime(0) // let the mount effect run
    })
    expect(result.current).toBe(60)
  })

  it('ticks down once per second', () => {
    const target = new Date(NOW + 60_000).toISOString()
    const { result } = renderHook(() => useCountdown(60, target, () => {}))
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current).toBe(57)
  })

  it('clamps at zero and fires onExpire exactly once', () => {
    const onExpire = vi.fn()
    const target = new Date(NOW + 2000).toISOString()
    const { result } = renderHook(() => useCountdown(2, target, onExpire))
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current).toBe(0)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('fires onExpire when it mounts already past the rotation moment', () => {
    const onExpire = vi.fn()
    const target = new Date(NOW - 1000).toISOString()
    renderHook(() => useCountdown(0, target, onExpire))
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(onExpire).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -F @neighborhue/web test`
Expected: FAIL — `./useCountdown` does not exist.

- [ ] **Step 3: Implement the hook**

Create `apps/web/src/hooks/useCountdown.ts`:

```ts
import { useEffect, useRef, useState } from 'react'

/**
 * Live countdown to the next rotation.
 *
 * Ticks from the ABSOLUTE `nextRotationAt` timestamp, never from a relative
 * seconds value (spec S6): the API sets `Cache-Control: max-age=
 * seconds_until_rotation`, so a cached response carries a stale relative count
 * and would produce a countdown wrong by however long it sat in cache.
 *
 * `seedSeconds` is the server-rendered value. It is used for the first render
 * only, so hydrated HTML matches the server byte-for-byte (spec S7); the mount
 * effect then recomputes from the absolute timestamp, silently correcting any
 * clock skew.
 */
export function useCountdown(seedSeconds: number, nextRotationAt: string, onExpire: () => void): number {
  const [seconds, setSeconds] = useState(seedSeconds)

  // Held in a ref so a caller re-creating the callback doesn't restart the timer.
  const onExpireRef = useRef(onExpire)
  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    const target = new Date(nextRotationAt).getTime()
    const remaining = () => Math.max(0, Math.round((target - Date.now()) / 1000))

    let fired = false
    const expireOnce = () => {
      if (fired) return
      fired = true
      onExpireRef.current()
    }

    const initial = remaining()
    setSeconds(initial)
    if (initial <= 0) {
      expireOnce()
      return
    }

    const id = setInterval(() => {
      const next = remaining()
      setSeconds(next)
      if (next <= 0) {
        clearInterval(id)
        expireOnce()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [nextRotationAt])

  return seconds
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -F @neighborhue/web test`
Expected: PASS (all 5 useCountdown tests).

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check:fix
git add apps/web/src/hooks/useCountdown.ts apps/web/src/hooks/useCountdown.test.ts
git commit -m "feat(web): useCountdown ticking from the absolute rotation timestamp

Seeds from the SSR value so hydration matches, then ticks from
next_rotation_at rather than seconds_until_rotation — the API caches
responses with max-age equal to that relative count, so it goes stale
in cache while the absolute timestamp does not.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `CopyButton` — three call sites, including the rejection path

**Files:**
- Create: `apps/web/src/components/CopyButton.tsx`, `CopyButton.module.css`, `CopyButton.test.tsx`

**Interfaces:**
- Produces: `<CopyButton value={string} label={string} variant?: 'primary' | 'ghost' style?: CSSProperties className?: string />`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/CopyButton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CopyButton } from './CopyButton'

function mockClipboard(impl: () => Promise<void>) {
  Object.assign(navigator, { clipboard: { writeText: vi.fn(impl) } })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CopyButton', () => {
  it('writes the value to the clipboard and confirms', async () => {
    mockClipboard(() => Promise.resolve())
    const user = userEvent.setup()
    render(<CopyButton value="https://neighborhue.app/n/abc" label="Copy share link" />)

    await user.click(screen.getByRole('button', { name: /copy share link/i }))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://neighborhue.app/n/abc')
    expect(await screen.findByText('Copied!')).toBeInTheDocument()
  })

  it('falls back to a manual-copy hint when the clipboard is unavailable', async () => {
    // Rejects in insecure contexts and under some permission setups.
    mockClipboard(() => Promise.reject(new Error('denied')))
    const user = userEvent.setup()
    render(<CopyButton value="x" label="Copy share link" />)

    await user.click(screen.getByRole('button', { name: /copy share link/i }))

    expect(await screen.findByText(/press ⌘c/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Add the test-user dependency and run the test**

```bash
pnpm -F @neighborhue/web add -D @testing-library/user-event@^14.6.1
pnpm -F @neighborhue/web test
```
Expected: FAIL — `./CopyButton` does not exist.

- [ ] **Step 3: Implement the component**

Create `apps/web/src/components/CopyButton.module.css`:

```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px; /* handoff: hit targets >= 44px */
  padding: 0 16px;
  border-radius: 12px;
  border: 1px solid var(--hairline);
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.primary {
  border-color: transparent;
}

.button:focus-visible {
  /* Contrast against an arbitrary daily hue (spec S10). */
  outline: 2px solid var(--ink, var(--text));
  outline-offset: 2px;
}
```

Create `apps/web/src/components/CopyButton.tsx`:

```tsx
import { CheckIcon, CopyIcon } from '@radix-ui/react-icons'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import styles from './CopyButton.module.css'

const RESET_MS = 1600 // handoff: "Copied!" shows for ~1.6s

interface CopyButtonProps {
  value: string
  label: string
  variant?: 'primary' | 'ghost'
  style?: CSSProperties
  className?: string
}

export function CopyButton({ value, label, variant = 'ghost', style, className }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setState('copied')
    } catch {
      // navigator.clipboard rejects in insecure contexts / denied permissions.
      setState('failed')
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), RESET_MS)
  }

  const text = state === 'copied' ? 'Copied!' : state === 'failed' ? 'Press ⌘C to copy' : label

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      style={style}
      className={[styles.button, variant === 'primary' ? styles.primary : '', className].filter(Boolean).join(' ')}
    >
      {state === 'copied' ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      <span>{text}</span>
    </button>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -F @neighborhue/web test`
Expected: PASS (both success and rejection paths).

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check:fix
git add apps/web/src/components/CopyButton.tsx apps/web/src/components/CopyButton.module.css apps/web/src/components/CopyButton.test.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): reusable CopyButton with clipboard-failure fallback

Three call sites on the Share page alone (share link, neighborhood UUID,
HA snippet). Handles navigator.clipboard rejection — real in insecure
contexts — with a manual-copy hint instead of failing silently.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Assets, `Logo`, shared config, global utilities

Closes the gitignored-assets gap (S12) and adds the small shared pieces later tasks need.

**Files:**
- Create: `apps/web/public/lockup-dark-text.png`, `apps/web/public/lockup-light.png`, `apps/web/public/logo-icon.png`
- Create: `apps/web/src/lib/config.ts`
- Create: `apps/web/src/components/Logo.tsx`, `apps/web/src/components/Logo.test.tsx`
- Modify: `apps/web/src/styles/reset.css`, `apps/web/src/lib/queries.ts`, `apps/web/src/routes/__root.tsx`

**Interfaces:**
- Produces: `API_URL: string` from `lib/config.ts`
- Produces: `<Logo lockup={'light' | 'dark-text'} height?: number />` — `lockup` comes from `colorTheme(hex).lockup`
- Produces: global `.sr-only` class

- [ ] **Step 1: Copy the assets out of the gitignored handoff bundle**

```bash
mkdir -p apps/web/public
cp "docs/handoff/neighborhue/design_handoff_neighborhue/assets/lockup-dark-text.png" apps/web/public/
cp "docs/handoff/neighborhue/design_handoff_neighborhue/assets/lockup-light.png" apps/web/public/
cp "docs/handoff/neighborhue/design_handoff_neighborhue/assets/logo-icon.png" apps/web/public/
ls -la apps/web/public/
```
Expected: three PNGs present. They must be **committed** — `docs/handoff/` is gitignored, so without this the deployed app has no logo.

- [ ] **Step 2: Extract the shared API base URL**

Create `apps/web/src/lib/config.ts`:

```ts
// Public, non-secret. VITE_API_URL is an optional local override (e.g. to point
// at a local `wrangler dev` API); apps/web/.env is gitignored, so the fallback
// is what production builds use.
export const API_URL = import.meta.env.VITE_API_URL ?? 'https://api.neighborhue.app'
```

Update `apps/web/src/lib/queries.ts` to consume it (replacing its local constant):

```ts
import { queryOptions } from '@tanstack/react-query'
import { API_URL } from './config'
import { fetchNeighborhood } from './neighborhood'

export function neighborhoodQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['neighborhood', id],
    queryFn: () => fetchNeighborhood(API_URL, id),
  })
}
```

- [ ] **Step 3: Add the global `.sr-only` utility and hue-aware focus ring**

Append to `apps/web/src/styles/reset.css`:

```css
/* Screen-reader-only text: available to assistive tech, invisible on screen. */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

/* Focus must stay visible against an arbitrary daily hue (spec S10): --ink is
   the WCAG-readable ink computed for the current color, falling back to --text
   on neutral chrome. */
:focus-visible {
  outline: 2px solid var(--ink, var(--text));
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Write the failing Logo test**

Create `apps/web/src/components/Logo.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Logo } from './Logo'

describe('Logo', () => {
  it('uses the light wordmark when the ink is light (dark background)', () => {
    render(<Logo lockup="light" />)
    expect(screen.getByAltText('Neighborhue')).toHaveAttribute('src', '/lockup-light.png')
  })
  it('uses the dark wordmark when the ink is dark (light background)', () => {
    render(<Logo lockup="dark-text" />)
    expect(screen.getByAltText('Neighborhue')).toHaveAttribute('src', '/lockup-dark-text.png')
  })
})
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm -F @neighborhue/web test`
Expected: FAIL — `./Logo` does not exist.

- [ ] **Step 6: Implement Logo**

Create `apps/web/src/components/Logo.tsx`:

```tsx
import type { ColorTheme } from '../color/theme'

interface LogoProps {
  // Comes from colorTheme(hex).lockup — 'light' means a light wordmark for a
  // dark background, and vice versa.
  lockup: ColorTheme['lockup']
  height?: number
}

export function Logo({ lockup, height = 44 }: LogoProps) {
  const src = lockup === 'light' ? '/lockup-light.png' : '/lockup-dark-text.png'
  return <img src={src} alt="Neighborhue" style={{ height, width: 'auto' }} />
}
```

- [ ] **Step 7: Wire the favicon**

In `apps/web/src/routes/__root.tsx`, add a `links` entry alongside the existing `head` `meta` array:

```tsx
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Neighborhue' },
    ],
    links: [{ rel: 'icon', href: '/logo-icon.png' }],
  }),
```

- [ ] **Step 8: Run tests, typecheck, lint, commit**

```bash
pnpm -F @neighborhue/web test && pnpm -F @neighborhue/web typecheck && pnpm check:fix
git add apps/web/public apps/web/src/lib/config.ts apps/web/src/lib/queries.ts apps/web/src/styles/reset.css apps/web/src/components/Logo.tsx apps/web/src/components/Logo.test.tsx apps/web/src/routes/__root.tsx
git commit -m "feat(web): commit logo assets, add Logo, sr-only and hue-aware focus

The lockups lived only in the gitignored handoff bundle, so the deployed
app had no logo. Adds the ink-aware Logo, a favicon, a screen-reader-only
utility, and a focus ring that uses the computed ink so it stays visible
against any daily hue.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `SwatchRow` and `Countdown` presentational components

**Files:**
- Create: `apps/web/src/components/SwatchRow.tsx`, `SwatchRow.module.css`, `SwatchRow.test.tsx`
- Create: `apps/web/src/components/Countdown.tsx`, `Countdown.module.css`

**Interfaces:**
- Consumes: `PaletteColor` (Task 1), `formatCountdown` (Task 1)
- Produces: `<SwatchRow colors={PaletteColor[]} />` — renders nothing when empty
- Produces: `<Countdown seconds={number} />`

- [ ] **Step 1: Write the failing SwatchRow test**

Create `apps/web/src/components/SwatchRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SwatchRow } from './SwatchRow'

const colors = [
  { hex: '#FF0000', name: 'Red' },
  { hex: '#0080FF', name: 'Blue' },
]

describe('SwatchRow', () => {
  it('renders one swatch per color with an accessible group label', () => {
    render(<SwatchRow colors={colors} />)
    const group = screen.getByRole('img', { name: /2 palette colors/i })
    expect(group).toBeInTheDocument()
    expect(group.children).toHaveLength(2)
  })

  it('renders nothing when there are no colors (custom-color neighborhoods)', () => {
    const { container } = render(<SwatchRow colors={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @neighborhue/web test`
Expected: FAIL — `./SwatchRow` does not exist.

- [ ] **Step 3: Implement both components**

Create `apps/web/src/components/SwatchRow.module.css`:

```css
.row {
  display: flex;
  flex-wrap: wrap; /* the `mixed` palette has 20 colors — it must wrap, not overflow */
  gap: 3px;
}

.swatch {
  width: 15px;
  height: 24px;
  border-radius: 5px;
}
```

Create `apps/web/src/components/SwatchRow.tsx`:

```tsx
import type { PaletteColor } from '../lib/palette'
import styles from './SwatchRow.module.css'

interface SwatchRowProps {
  colors: PaletteColor[]
}

export function SwatchRow({ colors }: SwatchRowProps) {
  if (colors.length === 0) return null
  return (
    // One group label rather than 20 individually-announced chips: the palette
    // name above already carries the meaning.
    <div className={styles.row} role="img" aria-label={`${colors.length} palette colors`}>
      {colors.map((c) => (
        <span key={`${c.hex}-${c.name}`} className={styles.swatch} style={{ background: c.hex }} title={`${c.name} ${c.hex}`} />
      ))}
    </div>
  )
}
```

Create `apps/web/src/components/Countdown.module.css`:

```css
.countdown {
  font-family: var(--font-mono);
  font-size: 52px; /* handoff: share-page countdown is Geist Mono 52 */
  font-weight: 500;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums; /* digits must not jitter as they tick */
}
```

Create `apps/web/src/components/Countdown.tsx`:

```tsx
import { formatCountdown } from '../lib/countdown'
import styles from './Countdown.module.css'

interface CountdownProps {
  seconds: number
}

export function Countdown({ seconds }: CountdownProps) {
  return (
    // Deliberately NOT aria-live (spec S11): this updates every second and
    // would flood a screen reader. It reads normally when navigated to.
    <p className={styles.countdown}>
      <span className="sr-only">Time until the next color: </span>
      {formatCountdown(seconds)}
    </p>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F @neighborhue/web test`
Expected: PASS.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check:fix
git add apps/web/src/components/SwatchRow.tsx apps/web/src/components/SwatchRow.module.css apps/web/src/components/SwatchRow.test.tsx apps/web/src/components/Countdown.tsx apps/web/src/components/Countdown.module.css
git commit -m "feat(web): SwatchRow and Countdown presentational components

Swatches wrap (the mixed palette has 20 colors) and announce as one
labelled group rather than 20 chips. The countdown uses tabular numerals
and is deliberately not an aria-live region.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `HaPanel` — Radix Collapsible with the owner-authored YAML

**Files:**
- Create: `apps/web/src/components/HaPanel.tsx`, `HaPanel.module.css`, `HaPanel.test.tsx`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes: `CopyButton` (Task 3), `API_URL` (Task 4)
- Produces: `<HaPanel neighborhoodId={string} />`

The YAML is copied from the project's own `README.md` "Home Assistant" section — it is owner-authored and already documented, with `<your-id>` substituted. Do **not** invent different YAML. No blueprint button (S2).

- [ ] **Step 1: Install Radix Collapsible**

```bash
pnpm -F @neighborhue/web add @radix-ui/react-collapsible@^1.1.17
```

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/components/HaPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HaPanel } from './HaPanel'

describe('HaPanel', () => {
  it('is collapsed by default and reveals the id and YAML when opened', async () => {
    const user = userEvent.setup()
    render(<HaPanel neighborhoodId="abc-123" />)

    expect(screen.queryByText(/platform: rest/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /add to home assistant/i }))

    expect(screen.getByText('abc-123')).toBeInTheDocument()
    expect(screen.getByText(/platform: rest/)).toBeInTheDocument()
    // The snippet must target this neighborhood's endpoint.
    expect(screen.getByText(/v1\/neighborhoods\/abc-123/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm -F @neighborhue/web test`
Expected: FAIL — `./HaPanel` does not exist.

- [ ] **Step 4: Implement HaPanel**

Create `apps/web/src/components/HaPanel.module.css`:

```css
.trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  width: 100%;
  border-radius: 12px;
  border: 1px solid var(--hairline);
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.panel {
  margin-top: 12px;
  padding: 18px;
  border-radius: 14px;
  border: 1px solid var(--hairline);
  background: var(--surface-2);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.intro {
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-muted);
}

.idRow {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.id {
  font-family: var(--font-mono);
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--hairline);
  overflow-wrap: anywhere;
}

.code {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
  padding: 14px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--hairline);
  overflow-x: auto; /* long YAML lines scroll rather than breaking layout */
}
```

Create `apps/web/src/components/HaPanel.tsx`:

```tsx
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDownIcon, DownloadIcon } from '@radix-ui/react-icons'
import { API_URL } from '../lib/config'
import { CopyButton } from './CopyButton'
import styles from './HaPanel.module.css'

interface HaPanelProps {
  neighborhoodId: string
}

// Verbatim from the project README's "Home Assistant" section, with the id
// substituted. color.rgb is a drop-in for rgb_color — no parsing needed.
function snippet(id: string): string {
  return `sensor:
  - platform: rest
    name: neighborhue
    resource: ${API_URL}/v1/neighborhoods/${id}
    value_template: "{{ value_json.color.hex }}"
    json_attributes_path: "$.color"
    json_attributes: [hex, rgb, hsl]
    scan_interval: 900

automation:
  - alias: "Neighborhue — apply daily color"
    trigger:
      - platform: state
        entity_id: sensor.neighborhue
    action:
      - service: light.turn_on
        target: { entity_id: light.porch }
        data:
          rgb_color: "{{ state_attr('sensor.neighborhue','rgb') }}"`
}

export function HaPanel({ neighborhoodId }: HaPanelProps) {
  const yaml = snippet(neighborhoodId)
  return (
    <Collapsible.Root>
      <Collapsible.Trigger className={styles.trigger}>
        <DownloadIcon aria-hidden />
        <span>Add to Home Assistant</span>
        <ChevronDownIcon aria-hidden style={{ marginLeft: 'auto' }} />
      </Collapsible.Trigger>
      <Collapsible.Content className={styles.panel}>
        <p className={styles.intro}>
          Add this to your Home Assistant <code>configuration.yaml</code>, then point the automation at your own light.
        </p>
        <div className={styles.idRow}>
          <span className={styles.id}>{neighborhoodId}</span>
          <CopyButton value={neighborhoodId} label="Copy neighborhood ID" />
        </div>
        <pre className={styles.code}>{yaml}</pre>
        <CopyButton value={yaml} label="Copy YAML" />
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm -F @neighborhue/web test`
Expected: PASS.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check:fix
git add apps/web/src/components/HaPanel.tsx apps/web/src/components/HaPanel.module.css apps/web/src/components/HaPanel.test.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): Add-to-Home-Assistant panel with copy-paste YAML

Radix Collapsible disclosure carrying the neighborhood id and the REST
sensor + automation snippet from the project README, targeted at this
neighborhood. No blueprint button: the HACS component and blueprint URL
aren't confirmed to exist, and a dead link is worse than none.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `ShareColorField` — the hue panel (replaces `ColorField`)

**Files:**
- Create: `apps/web/src/components/ShareColorField.tsx`, `ShareColorField.module.css`, `ShareColorField.test.tsx`
- Delete: `apps/web/src/components/ColorField.tsx`, `apps/web/src/components/ColorField.test.tsx`

**Interfaces:**
- Consumes: `colorTheme` (foundation), `Logo` (Task 4), `PublicColor` from `@neighborhue/api/types`
- Produces: `<ShareColorField name={string | null} color={PublicColor} paletteName={string} />`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/ShareColorField.test.tsx`:

```tsx
import type { PublicColor } from '@neighborhue/api/types'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ShareColorField } from './ShareColorField'

const yellow: PublicColor = { hex: '#FFD700', rgb: [255, 215, 0], hsl: [51, 100, 50], name: 'Yellow' }
const indigo: PublicColor = { hex: '#4B0082', rgb: [75, 0, 130], hsl: [275, 100, 25], name: 'Indigo' }

describe('ShareColorField', () => {
  it('always shows the color name and hex, never color alone', () => {
    render(<ShareColorField name="Maple Street" color={yellow} paletteName="Rainbow Colors" />)
    expect(screen.getByText('Yellow')).toBeInTheDocument()
    expect(screen.getByText('#FFD700')).toBeInTheDocument()
    expect(screen.getByText(/Maple Street/)).toBeInTheDocument()
    expect(screen.getByText(/Rainbow Colors/)).toBeInTheDocument()
  })

  it('applies the hue and computed ink as CSS variables', () => {
    const { container } = render(<ShareColorField name={null} color={yellow} paletteName="Rainbow Colors" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.style.getPropertyValue('--hue')).toBe('#FFD700')
    expect(root.style.getPropertyValue('--ink')).toBe('#181310')
  })

  it('swaps to the light lockup on a dark hue', () => {
    render(<ShareColorField name={null} color={indigo} paletteName="Cool" />)
    expect(screen.getByAltText('Neighborhue')).toHaveAttribute('src', '/lockup-light.png')
  })

  it('falls back to the product name when the neighborhood is unnamed', () => {
    render(<ShareColorField name={null} color={yellow} paletteName="Rainbow Colors" />)
    expect(screen.getByText(/Neighborhue · Today/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @neighborhue/web test`
Expected: FAIL — `./ShareColorField` does not exist.

- [ ] **Step 3: Implement the panel**

Create `apps/web/src/components/ShareColorField.module.css`:

```css
.field {
  flex: 1 1 46%; /* handoff §3 */
  background: var(--hue);
  color: var(--ink);
  display: flex;
  flex-direction: column;
  padding: 32px;
  gap: 12px;
  /* Cross-fade when the color rotates. prefers-reduced-motion disables this
     globally via reset.css (spec S9). */
  transition: background 0.5s ease, color 0.5s ease;
}

.top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.chip {
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 18px;
  background: var(--chip-bg);
  color: var(--ink);
}

.bottom {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--ink-muted);
}

.name {
  font-size: clamp(48px, 11vw, 104px); /* handoff: 104 / 600 / -.04em */
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 1;
}

.meta {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--ink-muted);
}

.tagline {
  margin-top: 18px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--ink-muted);
}
```

Create `apps/web/src/components/ShareColorField.tsx`:

```tsx
import type { PublicColor } from '@neighborhue/api/types'
import { Link } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import { colorTheme } from '../color/theme'
import { Logo } from './Logo'
import styles from './ShareColorField.module.css'

interface ShareColorFieldProps {
  name: string | null
  color: PublicColor
  paletteName: string
}

export function ShareColorField({ name, color, paletteName }: ShareColorFieldProps) {
  const t = colorTheme(color.hex)
  const style = {
    '--hue': color.hex,
    '--ink': t.ink,
    '--ink-muted': t.inkMuted,
    '--chip-bg': t.chipBg,
  } as CSSProperties

  return (
    <section className={styles.field} style={style}>
      <div className={styles.top}>
        <Link to="/" aria-label="Neighborhue home">
          <Logo lockup={t.lockup} />
        </Link>
        <span className={styles.chip}>{color.hex}</span>
      </div>

      <div className={styles.bottom}>
        <p className={styles.eyebrow}>{name ?? 'Neighborhue'} · Today</p>
        <h1 className={styles.name}>{color.name ?? color.hex}</h1>
        <p className={styles.meta}>
          {color.hex} · {paletteName}
        </p>
        <p className={styles.tagline}>Point your lights here — the whole street glows together.</p>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Delete the superseded component**

```bash
git rm apps/web/src/components/ColorField.tsx apps/web/src/components/ColorField.test.tsx
```

Note: `routes/n.$id.tsx` still imports `ColorField` and will fail to typecheck until Task 9 rewires it. To keep this task independently green, update that one import now:

```tsx
// apps/web/src/routes/n.$id.tsx — temporary until Task 9 builds the full layout
import { ShareColorField } from '../components/ShareColorField'
// ...
return <ShareColorField name={data.name} color={data.color} paletteName="" />
```

- [ ] **Step 5: Run tests, typecheck**

Run: `pnpm -F @neighborhue/web test && pnpm -F @neighborhue/web typecheck`
Expected: PASS — the four ShareColorField tests replace the two ColorField tests.

- [ ] **Step 6: Lint, commit**

```bash
pnpm check:fix
git add apps/web/src/components/ShareColorField.tsx apps/web/src/components/ShareColorField.module.css apps/web/src/components/ShareColorField.test.tsx apps/web/src/routes/n.\$id.tsx
git commit -m "feat(web): ShareColorField replaces the skeleton ColorField

The real hue panel: logo linking home, hex chip, eyebrow, display-size
color name, hex + palette row and the tagline. Reconciles the skeleton's
minHeight:100vh, since this is now a panel in a two-panel layout rather
than the whole page.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `DetailsPanel` — the neutral panel

**Files:**
- Create: `apps/web/src/components/DetailsPanel.tsx`, `DetailsPanel.module.css`, `DetailsPanel.test.tsx`

**Interfaces:**
- Consumes: `Countdown` (Task 5), `SwatchRow` (Task 5), `CopyButton` (Task 3), `HaPanel` (Task 6), `ResolvedPalette` (Task 1)
- Produces: `<DetailsPanel name={string | null} neighborhoodId={string} shareUrl={string} seconds={number} palette={ResolvedPalette} hue={string} ink={string} />`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/DetailsPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DetailsPanel } from './DetailsPanel'

const base = {
  name: 'Maple Street',
  neighborhoodId: 'abc-123',
  shareUrl: 'https://neighborhue.app/n/abc-123',
  seconds: 3661,
  hue: '#FFD700',
  ink: '#181310',
}

describe('DetailsPanel', () => {
  it('shows the neighborhood, a static Auto label, the countdown and the palette', () => {
    render(<DetailsPanel {...base} palette={{ kind: 'curated', name: 'Rainbow Colors', colors: [{ hex: '#FF0000', name: 'Red' }] }} />)

    expect(screen.getByText('Maple Street')).toBeInTheDocument()
    expect(screen.getByText('01:01:01')).toBeInTheDocument()
    expect(screen.getByText('Rainbow Colors')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /1 palette colors/i })).toBeInTheDocument()

    // The Auto chip is a label, not a control (spec S5).
    const auto = screen.getByText('Auto')
    expect(auto.tagName).not.toBe('BUTTON')
    expect(auto).not.toHaveAttribute('tabindex')
  })

  it('labels custom-color neighborhoods and shows no swatches', () => {
    render(<DetailsPanel {...base} palette={{ kind: 'custom' }} />)
    expect(screen.getByText('Custom colors')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /palette colors/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @neighborhue/web test`
Expected: FAIL — `./DetailsPanel` does not exist.

- [ ] **Step 3: Implement the panel**

Create `apps/web/src/components/DetailsPanel.module.css`:

```css
.panel {
  flex: 1 1 44%; /* handoff §3 */
  background: var(--surface-2);
  color: var(--text);
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 32px;
}

.topRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.neighborhood {
  font-size: 15px;
  font-weight: 600;
}

.auto {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  padding: 5px 10px;
  border-radius: 16px;
  border: 1px solid var(--hairline);
  color: var(--text-faint);
}

.label {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--text-faint);
}

.hairline {
  height: 1px;
  background: var(--hairline);
  border: 0;
  margin: 4px 0;
}

.paletteName {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: auto;
}
```

Create `apps/web/src/components/DetailsPanel.tsx`:

```tsx
import type { ResolvedPalette } from '../lib/palette'
import { Countdown } from './Countdown'
import { CopyButton } from './CopyButton'
import { HaPanel } from './HaPanel'
import { SwatchRow } from './SwatchRow'
import styles from './DetailsPanel.module.css'

interface DetailsPanelProps {
  name: string | null
  neighborhoodId: string
  shareUrl: string
  seconds: number
  palette: ResolvedPalette
  hue: string
  ink: string
}

export function DetailsPanel({ name, neighborhoodId, shareUrl, seconds, palette, hue, ink }: DetailsPanelProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.topRow}>
        <span className={styles.neighborhood}>{name ?? 'Neighborhue'}</span>
        {/* Static label: the page follows the system theme, there is nothing
            to toggle (spec S5). */}
        <span className={styles.auto}>Auto</span>
      </div>

      <div>
        <p className={styles.label}>Next color in</p>
        <Countdown seconds={seconds} />
      </div>

      <hr className={styles.hairline} />

      <div>
        <p className={styles.paletteName}>{palette.kind === 'custom' ? 'Custom colors' : palette.name}</p>
        {palette.kind === 'curated' && <SwatchRow colors={palette.colors} />}
      </div>

      <div className={styles.actions}>
        <CopyButton
          value={shareUrl}
          label="Copy share link"
          variant="primary"
          // Tinted to the daily color, per handoff §3.
          style={{ background: hue, color: ink }}
        />
        <HaPanel neighborhoodId={neighborhoodId} />
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F @neighborhue/web test`
Expected: PASS.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check:fix
git add apps/web/src/components/DetailsPanel.tsx apps/web/src/components/DetailsPanel.module.css apps/web/src/components/DetailsPanel.test.tsx
git commit -m "feat(web): DetailsPanel with countdown, palette and actions

Assembles the neutral panel: neighborhood + static Auto label, the live
countdown, palette name with swatches (omitted for custom-color
neighborhoods), a share-link copy button tinted to the daily hue, and the
Home Assistant disclosure.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Route assembly — parallel loader, two-panel layout, rotation rollover

**Files:**
- Modify: `apps/web/src/lib/queries.ts` (add `palettesQueryOptions`)
- Create: `apps/web/src/routes/n.$id.module.css`
- Modify: `apps/web/src/routes/n.$id.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–8.
- Produces: `palettesQueryOptions()` — query options keyed `['palettes']`.

- [ ] **Step 1: Add the palettes query options**

Append to `apps/web/src/lib/queries.ts`:

```ts
import type { PaletteSummary } from './palette'
import { fetchPalettes } from './client'

// Curated palettes are static content: fetch once and keep it.
export function palettesQueryOptions() {
  return queryOptions({
    queryKey: ['palettes'],
    queryFn: (): Promise<PaletteSummary[]> => fetchPalettes(API_URL),
    staleTime: Number.POSITIVE_INFINITY,
  })
}
```

- [ ] **Step 2: Add the page layout stylesheet**

Create `apps/web/src/routes/n.$id.module.css`:

```css
.page {
  display: flex;
  flex-wrap: wrap; /* stacks on mobile, per handoff §3 */
  min-height: 100vh;
}
```

- [ ] **Step 3: Rewrite the route**

Replace `apps/web/src/routes/n.$id.tsx` with:

```tsx
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { useCallback, useEffect, useRef } from 'react'
import { colorTheme } from '../color/theme'
import { DetailsPanel } from '../components/DetailsPanel'
import { ShareColorField } from '../components/ShareColorField'
import { useCountdown } from '../hooks/useCountdown'
import { NeighborhoodNotFound } from '../lib/errors'
import { resolvePalette } from '../lib/palette'
import { neighborhoodQueryOptions, palettesQueryOptions } from '../lib/queries'
import styles from './n.$id.module.css'

export const Route = createFileRoute('/n/$id')({
  // SSR (default): the hue paints with zero JS and OG tags unfurl.
  loader: async ({ context, params }) => {
    try {
      // Both prime the Query cache so the component's useSuspenseQuery calls
      // are hits; the neighborhood is returned so `head` can read today's color.
      const [neighborhood] = await Promise.all([
        context.queryClient.ensureQueryData(neighborhoodQueryOptions(params.id)),
        context.queryClient.ensureQueryData(palettesQueryOptions()),
      ])
      return neighborhood
    } catch (err) {
      // Unknown id -> real 404 status, not a 200 rendering a 404-shaped page.
      if (err instanceof NeighborhoodNotFound) throw notFound()
      throw err
    }
  },
  head: ({ loaderData }) => {
    const label = loaderData ? (loaderData.color.name ?? loaderData.color.hex) : 'today’s color'
    return {
      meta: [
        { title: `${label} — Neighborhue` },
        { property: 'og:title', content: loaderData ? label : 'Neighborhue' },
        { property: 'og:description', content: 'The whole neighborhood glows the same color today.' },
      ],
    }
  },
  component: NeighborhoodShare,
})

function NeighborhoodShare() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(neighborhoodQueryOptions(id))
  const { data: palettes } = useSuspenseQuery(palettesQueryOptions())
  const queryClient = useQueryClient()

  const palette = resolvePalette(data.palette, palettes)
  const theme = colorTheme(data.color.hex)

  // Rotation rollover (spec S8): refetch after a grace period so the new color
  // arrives, backing off if the server hasn't rolled over yet (client clock
  // ahead). Attempts reset whenever a new day's color actually lands.
  const attempts = useRef(0)
  useEffect(() => {
    attempts.current = 0
  }, [])

  const onExpire = useCallback(() => {
    const delay = 2000 * 2 ** Math.min(attempts.current, 3) // 2s, 4s, 8s, 16s
    attempts.current += 1
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['neighborhood', id] })
    }, delay)
  }, [queryClient, id])

  const seconds = useCountdown(data.seconds_until_rotation, data.next_rotation_at, onExpire)

  const shareUrl = typeof window === 'undefined' ? `https://neighborhue.app/n/${id}` : window.location.href

  return (
    <main className={styles.page}>
      <ShareColorField
        name={data.name}
        color={data.color}
        paletteName={palette.kind === 'custom' ? 'Custom colors' : palette.name}
      />
      <DetailsPanel
        name={data.name}
        neighborhoodId={id}
        shareUrl={shareUrl}
        seconds={seconds}
        palette={palette}
        hue={data.color.hex}
        ink={theme.ink}
      />
    </main>
  )
}
```

- [ ] **Step 4: Verify locally — SSR, layout, 404**

Create a throwaway neighborhood and check the rendered page:

```bash
curl -s -X POST https://api.neighborhue.app/v1/neighborhoods \
  -H 'Content-Type: application/json' \
  -d '{"name":"Spec 2a Test","timezone":"America/New_York","rotation_hour":7}'
```
Record the returned `id` (the `admin_secret` is NOT needed — do not copy it into any file).

Start the dev server (`pnpm -F @neighborhue/web dev`, read the port from its log — it has been 5173) and check:

```bash
curl -s http://localhost:5173/n/{id} | command grep -aoiE '#[0-9A-F]{6}' | head -3   # hue + ink in raw HTML
curl -s http://localhost:5173/n/{id} | command grep -ao 'Point your lights here'      # tagline SSR'd
curl -s http://localhost:5173/n/{id} | command grep -ao 'Next color in'               # details panel SSR'd
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/n/does-not-exist       # 404
```
Expected: the hue hex appears in raw pre-JS HTML, both strings print, and the unknown id returns `404`. Also open the page in a browser and confirm the two panels sit side by side, stack on a narrow window, and the countdown ticks. Stop the dev server.

- [ ] **Step 5: Run tests, typecheck, lint, commit**

```bash
pnpm -F @neighborhue/web test && pnpm -F @neighborhue/web typecheck && pnpm check:fix
git add apps/web/src/lib/queries.ts apps/web/src/routes/n.\$id.tsx apps/web/src/routes/n.\$id.module.css
git commit -m "feat(web): assemble the Share page — parallel loader, two panels

Fetches the neighborhood and the palette list in parallel (both SSR'd,
both priming the Query cache), resolves the palette by slug, and renders
the hue panel beside the details panel. The countdown drives a rollover
refetch so the page picks up the new color when it flips.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Styled 404 and error states for the share route

A dead share link is a common real path — stale link, or a deleted neighborhood. Turn it into the funnel (S15).

**Files:**
- Modify: `apps/web/src/routes/n.$id.tsx`
- Create: `apps/web/src/routes/n.$id.states.module.css`

- [ ] **Step 1: Add the stylesheet**

Create `apps/web/src/routes/n.$id.states.module.css`:

```css
.state {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 40px;
  text-align: center;
  background: var(--page-bg);
  color: var(--text);
}

.title {
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.body {
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-muted);
  max-width: 420px;
}

.cta {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 18px;
  border-radius: 13px;
  background: var(--cta-bg);
  color: var(--cta-fg);
  font-weight: 600;
  text-decoration: none;
}
```

- [ ] **Step 2: Add the two components to the route**

In `apps/web/src/routes/n.$id.tsx`, add these imports and route options (keeping everything from Task 9):

```tsx
import { Link, useRouter } from '@tanstack/react-router'
import stateStyles from './n.$id.states.module.css'
```

Add to the `createFileRoute` options object, alongside `component`:

```tsx
  notFoundComponent: () => (
    <main className={stateStyles.state}>
      <h1 className={stateStyles.title}>This neighborhood doesn’t exist</h1>
      <p className={stateStyles.body}>
        The link may be mistyped, or the neighborhood may have been deleted. You can start a new one in about a minute —
        no account needed.
      </p>
      <Link to="/create" className={stateStyles.cta}>
        Create a neighborhood
      </Link>
    </main>
  ),
  errorComponent: ({ error }) => <ShareError message={error.message} />,
```

And add the error component below `NeighborhoodShare`:

```tsx
function ShareError({ message }: { message: string }) {
  const router = useRouter()
  return (
    <main className={stateStyles.state}>
      <h1 className={stateStyles.title}>Couldn’t load today’s color</h1>
      <p className={stateStyles.body}>{message}</p>
      <button type="button" className={stateStyles.cta} onClick={() => router.invalidate()}>
        Try again
      </button>
    </main>
  )
}
```

- [ ] **Step 3: Verify both states locally**

With the dev server running:

```bash
curl -s http://localhost:5173/n/does-not-exist | command grep -ao 'doesn’t exist'
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/n/does-not-exist
```
Expected: the copy prints and the status is still `404` — styling the state must not change the status code.

- [ ] **Step 4: Run tests, typecheck, lint, commit**

```bash
pnpm -F @neighborhue/web test && pnpm -F @neighborhue/web typecheck && pnpm check:fix
git add apps/web/src/routes/n.\$id.tsx apps/web/src/routes/n.\$id.states.module.css
git commit -m "feat(web): styled 404 and error states for the share route

A dead share link is a common path — stale link or deleted neighborhood —
so the 404 explains what happened and offers to create one, turning a
dead end into the funnel. Still returns a real 404 status.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Deploy and verify in production

> **Gate:** deploying publishes to the live `neighborhue.app`. Confirm with the maintainer before running Step 2, as with the foundation deploy.

**Files:** none (build + deploy + verification only).

- [ ] **Step 1: Full repo checks and production build**

```bash
pnpm -r typecheck && pnpm -r test && pnpm check && pnpm -F @neighborhue/web build
```
Expected: both apps typecheck, all API + web tests pass, Biome clean, and the build emits `dist/client` + `dist/server`.

- [ ] **Step 2: Deploy**

```bash
pnpm -F @neighborhue/web exec wrangler whoami   # must be andys@andyshinn.as / 0bddc8c62dd00882bc061416e8be2ce4
pnpm -F @neighborhue/web deploy
```

- [ ] **Step 3: Verify the live page**

With the id created in Task 9 Step 4:

```bash
curl -s https://neighborhue.app/n/{id} | command grep -aoiE '#[0-9A-F]{6}' | head -3
curl -s https://neighborhue.app/n/{id} | command grep -ao 'og:[a-z]*' | sort -u
curl -s https://neighborhue.app/n/{id} | command grep -ao 'Next color in'
curl -s -o /dev/null -w '%{http_code}\n' https://neighborhue.app/n/does-not-exist
```
Expected: the hue hex appears in raw pre-JS HTML, OG tags are present, the details panel is server-rendered, and the unknown id returns `404`.

Note: the very first request to a freshly-deployed cold Worker has previously returned a one-off `500`; re-request before investigating. Confirm with a handful of repeats.

Then open the page in a browser and confirm: two panels side by side (stacking on narrow widths), the countdown ticking, "Copy share link" copying, the HA disclosure opening with the id and YAML, and dark mode following the system setting.

- [ ] **Step 4: Clean up the test neighborhood**

Delete the throwaway neighborhood created in Task 9 so it doesn't linger in production. Its `admin_secret` was printed when it was created:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE \
  -H "Authorization: Bearer <admin_secret>" \
  https://api.neighborhue.app/v1/neighborhoods/{id}
```
Expected: `204`. Do not paste the secret into any file.

---

## Self-Review

**1. Spec coverage** — every spec decision maps to a task:

| Spec | Requirement | Task |
|---|---|---|
| S2 | HA panel: YAML + UUID, no blueprint button | 6 |
| S3 | Palette via second fetch; custom → no swatches | 1 (`resolvePalette`), 9 (`palettesQueryOptions`), 8 (render) |
| S4 | Footer links dropped | 7 (tagline only — no preview/manage links) |
| S5 | Auto is a static label | 8 (+ test asserts it isn't a button) |
| S6 | Tick from absolute `next_rotation_at` | 2 |
| S7 | SSR seed for first render | 2 |
| S8 | Clamp at zero, grace + backoff refetch | 1 (clamp), 2 (clamp/expire), 9 (backoff) |
| S9 | Reduced motion disables cross-fade, countdown keeps ticking | 4 (global media query), 7 (transition) |
| S10 | Focus ring uses `--ink` | 4 (global), 3 (button) |
| S11 | Countdown not `aria-live` | 5 |
| S12 | Assets committed | 4 |
| S13 | `ColorField` → `ShareColorField`, minHeight reconciled | 7 |
| S14 | `CopyButton` + Radix `Collapsible` | 3, 6 |
| S15 | Styled 404 with create CTA | 10 |
| §5.1 | Parallel loader priming the cache | 9 |
| §6 | Copy-failure fallback, error retry | 3, 10 |
| §7 | Unit + RTL coverage, post-deploy curl | 1–8, 11 |

No uncovered requirement. The spec's `mixed`-has-20-colors note is handled by `flex-wrap` in Task 5.

**2. Placeholder scan** — no "TBD/TODO/handle appropriately"; every code step carries complete code. Task 7 Step 4's temporary one-line route edit is explicit and real (not deferred work) — it keeps that task independently green before Task 9 rewires the route.

**3. Type consistency** — `PaletteColor`/`PaletteSummary`/`ResolvedPalette` are defined once in Task 1 and imported unchanged in Tasks 5, 8, 9. `formatCountdown(seconds)` (Task 1) is used only by `Countdown` (Task 5). `useCountdown(seedSeconds, nextRotationAt, onExpire)` (Task 2) is called with exactly those three arguments in Task 9. `colorTheme(hex).lockup` feeds `<Logo lockup>` (Tasks 4, 7). `<CopyButton value label variant style>` (Task 3) matches all three call sites (Tasks 6, 8). `palettesQueryOptions()` is defined and consumed in Task 9.

**Known residual risk:** the HA YAML is transcribed from the project README rather than executed against a live Home Assistant. It is the maintainer's own documented example, but Task 11's browser check is the moment to eyeball it.
