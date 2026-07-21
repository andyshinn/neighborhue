# Create Page (Spec 2b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/create` stub with the real Create screen — a validated form, an interactive cycling palette preview, and a success card that surfaces the share + secret management links.

**Architecture:** The route (`routes/create.tsx`) is a thin `ssr:false` shell: it loads palettes into the Query cache, runs the create mutation, and hands everything to a presentational `CreateView` that owns form state and the preview interaction. All other units are pure/props-driven and independently tested, matching the 2a pattern where the route is the only thing that touches data or timers. The daily color is server-deterministic and unknown before creation, so the preview cycles the selected palette as an honest sample (hover/focus pins a color); it never computes "today's" color client-side.

**Tech Stack:** React 19, TanStack Start/Router/Query, Radix Icons, CSS Modules + Radix Colors tokens, Hono (`hc`) typed client, Vitest + Testing Library + happy-dom, Biome, pnpm.

## Global Constraints

- **API wins** wherever it disagrees with the handoff.
- **No slugs (C6):** public link is `https://neighborhue.app/n/{id}`; management link is the API's `manage_url` (`{base}/manage/{id}#{secret}`).
- **Secret shown once (C5):** the create result lives in component state only — never persisted (no `localStorage`/`sessionStorage`) and never re-sent.
- **Route is the only data/timer toucher (C10):** components receive plain values + callbacks.
- **Reduced motion (C11):** the auto-cycle is disabled under `prefers-reduced-motion`; hover/focus preview still works.
- **Verbatim copy** (from handoff §2): H1 `Create a neighborhood`; subhead `Spin one up in under a minute. No account, no email — ownership is just the secret link you'll get at the end.`; labels `Neighborhood name` / `Time zone` / `Rotation hour` / `Palette`; name pill `optional`; name placeholder `e.g. Maple Street`; tz placeholder `America/New_York`; rotation help `The color flips at this time each morning.`; rotation tag `local`; tz hints `Detected from your device.` / `Looks good.` / `Use an IANA zone like America/New_York.`; custom note `Create the neighborhood first — you'll add and reorder your custom colors in Manage.`; submit `Create neighborhood`; preview caption `Updates as you edit. The real color is deterministic from the neighborhood + the day.`; success H2 `Your neighborhood is live`; success body `Share the public link with your neighbors. Keep the management link somewhere safe — it's how you get back in.`; link labels `Public share link` / `Private management link`; warning `Save this link — it's the only way back in. There are no accounts, and it can't be recovered if lost.`; CTAs `Open share page` / `Go to manage`; back button `Back`.
- **Only existing CSS tokens** from `styles/tokens.css` — do **not** modify `tokens.css` (dark-mode accent scales are a used-subset; a new step would break dark mode). Warning uses `--warning`/`--warning-tint`, success `--success`/`--success-tint`, error `--danger` — all already dark-safe.
- **Hit targets ≥44px** on all buttons/steppers/CTAs.
- **Tests:** `vi.mock('@tanstack/react-router')` for `Link` (no `RouterProvider` in unit tests); fake timers where time is involved.
- **Every commit ends with the trailer:**
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```
- **Verification commands:** web tests `pnpm -F @neighborhue/web test`; single web file `pnpm -F @neighborhue/web exec vitest run <path>`; web types `pnpm -F @neighborhue/web typecheck`; api tests `pnpm -F @neighborhue/api test`; api types `pnpm -F @neighborhue/api typecheck`; lint `pnpm check` (fix with `pnpm check:fix`).

---

## File Structure

**apps/api (Task 1):**
- Modify `src/types.ts` — add `CreatedNeighborhood`.
- Modify `src/routes/neighborhoods.ts` — POST handler `satisfies CreatedNeighborhood`.
- Modify `src/routes/palettes.ts` — add `is_default` to each palette.
- Modify `test/api.palettes.test.ts` — assert `is_default`.

**apps/web:**
- `src/lib/hour.ts` (+ test) — `formatHourLabel`. *(Task 2)*
- `src/lib/timezone.ts` (+ test) — `validateTimezone`. *(Task 2)*
- `src/lib/neighborhood.ts` (modify, + test) — `createNeighborhood`, `CreateBody`. *(Task 3)*
- `src/lib/palette.ts` (modify) — `PaletteSummary.is_default`. *(Task 3)*
- `src/hooks/usePaletteCycle.ts` (+ test) — cycle index, reduced-motion aware. *(Task 4)*
- `src/components/RotationHourStepper.tsx` (+ css, + test). *(Task 5)*
- `src/components/TimezoneField.tsx` (+ css, + test). *(Task 6)*
- `src/components/PalettePicker.tsx` (+ css, + test). *(Task 7)*
- `src/components/ShareCard.tsx` (+ css, + test). *(Task 8)*
- `src/components/CreateSuccess.tsx` (+ css, + test). *(Task 9)*
- `src/components/CreateView.tsx` (+ css, + test). *(Task 10)*
- `src/routes/create.tsx` (modify — real route). *(Task 11)*

---

## Task 1: API — `CreatedNeighborhood` type + palettes `is_default`

**Files:**
- Modify: `apps/api/src/types.ts`
- Modify: `apps/api/src/routes/neighborhoods.ts:135-147`
- Modify: `apps/api/src/routes/palettes.ts:11-16`
- Test: `apps/api/test/api.palettes.test.ts`

**Interfaces:**
- Produces: `CreatedNeighborhood` (exported from `@neighborhue/api/types`) — consumed by web Task 3. `GET /v1/palettes` items gain `is_default: boolean`.

- [ ] **Step 1: Add the `is_default` assertion to the palettes test**

In `apps/api/test/api.palettes.test.ts`, add inside the `describe('GET /v1/palettes')` block:

```ts
it('marks exactly one palette as the default (rainbow)', async () => {
  const res = await SELF.fetch('https://x/v1/palettes')
  const body = (await res.json()) as { palettes: Array<{ slug: string; is_default: boolean }> }
  const defaults = body.palettes.filter((p) => p.is_default)
  expect(defaults.length).toBe(1)
  expect(defaults[0].slug).toBe('rainbow')
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm -F @neighborhue/api exec vitest run test/api.palettes.test.ts`
Expected: FAIL — `is_default` is `undefined`, so `defaults.length` is 0.

- [ ] **Step 3: Add `is_default` to the palettes response**

In `apps/api/src/routes/palettes.ts`, extend the mapped object:

```ts
list.map(async (p) => ({
  slug: p.slug,
  name: p.name,
  description: p.description,
  is_default: p.isDefault,
  colors: (await getPaletteColors(db, p.id)).map((col) => ({ hex: col.hex, name: col.name })),
})),
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm -F @neighborhue/api exec vitest run test/api.palettes.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the `CreatedNeighborhood` type**

In `apps/api/src/types.ts`, after the `PublicNeighborhood` interface, add:

```ts
// Shape returned by POST /v1/neighborhoods (201). Carries the one-time
// admin_secret and the assembled manage_url, which the public read never
// exposes. Exported so apps/web imports (not restates) it — a field rename
// here then fails apps/web typecheck, keeping the compile-time seam.
export interface CreatedNeighborhood {
  id: string
  admin_secret: string
  manage_url: string
  name: string | null
  timezone: string
  rotation_hour: number
  palette: string | null
  custom_colors: null
}
```

- [ ] **Step 6: Assert the POST handler `satisfies` it**

In `apps/api/src/routes/neighborhoods.ts`, import the type and add `satisfies` to the create response. Change the import on line 21 to include it:

```ts
import type { AppEnv, CreatedNeighborhood, PublicNeighborhood } from '../types'
```

Then change the create `c.json(...)` (lines 135-147) so the object literal is asserted:

```ts
return c.json(
  {
    id,
    admin_secret: adminSecret,
    manage_url: `${c.env.MANAGE_URL_BASE}/manage/${id}#${adminSecret}`,
    name: row.name,
    timezone: row.timezone,
    rotation_hour: row.rotationHour,
    palette: body.palette ?? null,
    custom_colors: null,
  } satisfies CreatedNeighborhood,
  201,
)
```

- [ ] **Step 7: Typecheck the API**

Run: `pnpm -F @neighborhue/api typecheck`
Expected: PASS (no errors — the literal already matches the interface).

- [ ] **Step 8: Run the full API suite + lint**

Run: `pnpm -F @neighborhue/api test && pnpm check`
Expected: all API tests PASS, Biome clean.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/types.ts apps/api/src/routes/neighborhoods.ts apps/api/src/routes/palettes.ts apps/api/test/api.palettes.test.ts
git commit -m "feat(api): CreatedNeighborhood type + is_default on palettes"
```

---

## Task 2: Web pure helpers — `formatHourLabel` + `validateTimezone`

**Files:**
- Create: `apps/web/src/lib/hour.ts`, `apps/web/src/lib/timezone.ts`
- Test: `apps/web/src/lib/hour.test.ts`, `apps/web/src/lib/timezone.test.ts`

**Interfaces:**
- Produces: `formatHourLabel(hour: number): string` (12-hour label, e.g. `"7:00 AM"`) — consumed by Tasks 5, 8, 10. `validateTimezone(tz: string): boolean` — consumed by Tasks 6, 10.

- [ ] **Step 1: Write the failing `formatHourLabel` test**

`apps/web/src/lib/hour.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatHourLabel } from './hour'

describe('formatHourLabel', () => {
  it('formats midnight and noon', () => {
    expect(formatHourLabel(0)).toBe('12:00 AM')
    expect(formatHourLabel(12)).toBe('12:00 PM')
  })
  it('formats morning and evening hours', () => {
    expect(formatHourLabel(7)).toBe('7:00 AM')
    expect(formatHourLabel(23)).toBe('11:00 PM')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @neighborhue/web exec vitest run src/lib/hour.test.ts`
Expected: FAIL — cannot find module `./hour`.

- [ ] **Step 3: Implement `hour.ts`**

`apps/web/src/lib/hour.ts`:

```ts
// 0–23 → a 12-hour label like "7:00 AM". The rotation hour is always a whole
// hour, so minutes are always ":00".
export function formatHourLabel(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${h12}:00 ${period}`
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -F @neighborhue/web exec vitest run src/lib/hour.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing `validateTimezone` test**

`apps/web/src/lib/timezone.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { validateTimezone } from './timezone'

describe('validateTimezone', () => {
  it('accepts real IANA zones', () => {
    expect(validateTimezone('America/New_York')).toBe(true)
    expect(validateTimezone('UTC')).toBe(true)
  })
  it('rejects garbage and empty input', () => {
    expect(validateTimezone('Mars/Base')).toBe(false)
    expect(validateTimezone('')).toBe(false)
  })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm -F @neighborhue/web exec vitest run src/lib/timezone.test.ts`
Expected: FAIL — cannot find module `./timezone`.

- [ ] **Step 7: Implement `timezone.ts`**

`apps/web/src/lib/timezone.ts`:

```ts
// `Intl.supportedValuesOf` is ES2022 runtime but not in the TS ES2022 lib types;
// widen locally rather than pulling in lib.esnext.
type IntlWithSupported = typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] }

// Validates an IANA zone the same way the API does in spirit: a membership check
// against the runtime's zone list, falling back to constructing a formatter
// (throws RangeError on an unknown zone) where the enumeration API is missing.
export function validateTimezone(tz: string): boolean {
  if (!tz) return false
  const intl = Intl as IntlWithSupported
  if (typeof intl.supportedValuesOf === 'function') {
    return intl.supportedValuesOf('timeZone').includes(tz)
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm -F @neighborhue/web exec vitest run src/lib/timezone.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck + lint + commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check
git add apps/web/src/lib/hour.ts apps/web/src/lib/hour.test.ts apps/web/src/lib/timezone.ts apps/web/src/lib/timezone.test.ts
git commit -m "feat(web): formatHourLabel + validateTimezone helpers"
```

---

## Task 3: Web lib — `createNeighborhood` + `PaletteSummary.is_default`

**Files:**
- Modify: `apps/web/src/lib/neighborhood.ts`
- Modify: `apps/web/src/lib/palette.ts:6-11`
- Test: `apps/web/src/lib/neighborhood.test.ts` (new)

**Interfaces:**
- Consumes: `CreatedNeighborhood` from `@neighborhue/api/types` (Task 1); `createClient` from `./client`; `ApiError`, `parseApiErrorBody` from `./errors`.
- Produces: `createNeighborhood(baseUrl: string, body: CreateBody): Promise<CreatedNeighborhood>` and `interface CreateBody` — consumed by Tasks 10, 11. `PaletteSummary.is_default: boolean` — consumed by Tasks 7, 10.

- [ ] **Step 1: Add `is_default` to `PaletteSummary`**

In `apps/web/src/lib/palette.ts`, add the field to the interface:

```ts
export interface PaletteSummary {
  slug: string
  name: string
  description: string | null
  is_default: boolean
  colors: PaletteColor[]
}
```

- [ ] **Step 2: Write the failing `createNeighborhood` test**

`apps/web/src/lib/neighborhood.test.ts`:

```ts
import type { CreatedNeighborhood } from '@neighborhue/api/types'
import { describe, expect, it, vi } from 'vitest'
import { createClient } from './client'
import { ApiError } from './errors'
import { createNeighborhood } from './neighborhood'

vi.mock('./client', () => ({ createClient: vi.fn() }))

const created: CreatedNeighborhood = {
  id: '11111111-1111-4111-8111-111111111111',
  admin_secret: 'nh_sk_secret',
  manage_url: 'https://neighborhue.app/manage/11111111-1111-4111-8111-111111111111#nh_sk_secret',
  name: 'Maple Street',
  timezone: 'America/New_York',
  rotation_hour: 7,
  palette: 'rainbow',
  custom_colors: null,
}

function stubPost(response: unknown) {
  vi.mocked(createClient).mockReturnValue({
    v1: { neighborhoods: { $post: vi.fn().mockResolvedValue(response) } },
  } as unknown as ReturnType<typeof createClient>)
}

describe('createNeighborhood', () => {
  it('returns the created neighborhood on success', async () => {
    stubPost({ ok: true, json: async () => created })
    await expect(createNeighborhood('https://api', { timezone: 'America/New_York', rotation_hour: 7 })).resolves.toEqual(
      created,
    )
  })

  it('throws ApiError with the API message on failure', async () => {
    stubPost({ ok: false, status: 400, json: async () => ({ error: 'palette_not_found', message: 'Unknown palette: nope' }) })
    await expect(createNeighborhood('https://api', { timezone: 'UTC', rotation_hour: 7, palette: 'nope' })).rejects.toThrow(
      new ApiError(400, 'palette_not_found', 'Unknown palette: nope'),
    )
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm -F @neighborhue/web exec vitest run src/lib/neighborhood.test.ts`
Expected: FAIL — `createNeighborhood` is not exported.

- [ ] **Step 4: Implement `createNeighborhood`**

In `apps/web/src/lib/neighborhood.ts`, update the import line and append the function + type. The new import line:

```ts
import type { CreatedNeighborhood, PublicNeighborhood } from '@neighborhue/api/types'
```

Append at the end of the file:

```ts
// Request body for POST /v1/neighborhoods. timezone + rotation_hour are always
// sent (the form always has them); name/palette are omitted when blank/custom.
export interface CreateBody {
  name?: string
  timezone: string
  rotation_hour: number
  palette?: string
}

export async function createNeighborhood(baseUrl: string, body: CreateBody): Promise<CreatedNeighborhood> {
  const res = await createClient(baseUrl).v1.neighborhoods.$post({ json: body })
  if (res.ok) {
    return (await res.json()) as CreatedNeighborhood
  }
  const errBody = parseApiErrorBody(await res.json().catch(() => null))
  throw new ApiError(res.status, errBody?.error ?? 'error', errBody?.message ?? `Request failed: ${res.status}`)
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm -F @neighborhue/web exec vitest run src/lib/neighborhood.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + lint + commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check
git add apps/web/src/lib/neighborhood.ts apps/web/src/lib/neighborhood.test.ts apps/web/src/lib/palette.ts
git commit -m "feat(web): createNeighborhood client + PaletteSummary.is_default"
```

---

## Task 4: Web hook — `usePaletteCycle`

**Files:**
- Create: `apps/web/src/hooks/usePaletteCycle.ts`
- Test: `apps/web/src/hooks/usePaletteCycle.test.ts`

**Interfaces:**
- Produces: `usePaletteCycle(length: number, intervalMs?: number): number` — returns the current cycle index in `[0, length)`, advancing every `intervalMs` (default 2000) unless `prefers-reduced-motion`; resets to 0 when `length` changes. Consumed by Task 10.

- [ ] **Step 1: Write the failing test**

`apps/web/src/hooks/usePaletteCycle.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePaletteCycle } from './usePaletteCycle'

const original = window.matchMedia

afterEach(() => {
  window.matchMedia = original
  vi.useRealTimers()
})

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

describe('usePaletteCycle', () => {
  it('advances and wraps on the interval', () => {
    stubReducedMotion(false)
    vi.useFakeTimers()
    const { result } = renderHook(() => usePaletteCycle(3, 2000))
    expect(result.current).toBe(0)
    act(() => vi.advanceTimersByTime(2000))
    expect(result.current).toBe(1)
    act(() => vi.advanceTimersByTime(4000))
    expect(result.current).toBe(0) // 1 -> 2 -> wraps to 0
  })

  it('stays put under prefers-reduced-motion', () => {
    stubReducedMotion(true)
    vi.useFakeTimers()
    const { result } = renderHook(() => usePaletteCycle(3, 2000))
    act(() => vi.advanceTimersByTime(6000))
    expect(result.current).toBe(0)
  })

  it('does not advance a single-color palette', () => {
    stubReducedMotion(false)
    vi.useFakeTimers()
    const { result } = renderHook(() => usePaletteCycle(1, 2000))
    act(() => vi.advanceTimersByTime(4000))
    expect(result.current).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @neighborhue/web exec vitest run src/hooks/usePaletteCycle.test.ts`
Expected: FAIL — cannot find module `./usePaletteCycle`.

- [ ] **Step 3: Implement the hook**

`apps/web/src/hooks/usePaletteCycle.ts`:

```ts
import { useEffect, useState } from 'react'

const DEFAULT_INTERVAL_MS = 2000

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// Walks 0..length-1 on a timer so the Create preview reads as a sample reel
// ("one of these, chosen each day"), never a fixed "today". Honors
// prefers-reduced-motion (C11) and resets when the palette (length) changes.
export function usePaletteCycle(length: number, intervalMs: number = DEFAULT_INTERVAL_MS): number {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
    if (length <= 1 || prefersReducedMotion()) return
    const id = setInterval(() => setIndex((i) => (i + 1) % length), intervalMs)
    return () => clearInterval(id)
  }, [length, intervalMs])

  return length > 0 ? index % length : 0
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -F @neighborhue/web exec vitest run src/hooks/usePaletteCycle.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + lint + commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check
git add apps/web/src/hooks/usePaletteCycle.ts apps/web/src/hooks/usePaletteCycle.test.ts
git commit -m "feat(web): usePaletteCycle preview hook"
```

---

## Task 5: `RotationHourStepper` component

**Files:**
- Create: `apps/web/src/components/RotationHourStepper.tsx`, `apps/web/src/components/RotationHourStepper.module.css`
- Test: `apps/web/src/components/RotationHourStepper.test.tsx`

**Interfaces:**
- Consumes: `formatHourLabel` (Task 2).
- Produces: `RotationHourStepper({ hour, onChange })` where `hour: number`, `onChange: (hour: number) => void`. Controlled; wraps 0–23. Consumed by Task 10.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/RotationHourStepper.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RotationHourStepper } from './RotationHourStepper'

describe('RotationHourStepper', () => {
  it('shows the 12-hour label', () => {
    render(<RotationHourStepper hour={7} onChange={() => {}} />)
    expect(screen.getByText('7:00 AM')).toBeInTheDocument()
  })

  it('wraps forward from 23 to 0', async () => {
    const onChange = vi.fn()
    render(<RotationHourStepper hour={23} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /later/i }))
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('wraps backward from 0 to 23', async () => {
    const onChange = vi.fn()
    render(<RotationHourStepper hour={0} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /earlier/i }))
    expect(onChange).toHaveBeenCalledWith(23)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/RotationHourStepper.test.tsx`
Expected: FAIL — cannot find module `./RotationHourStepper`.

- [ ] **Step 3: Implement the component + CSS**

`apps/web/src/components/RotationHourStepper.tsx`:

```tsx
import { MinusIcon, PlusIcon } from '@radix-ui/react-icons'
import { formatHourLabel } from '../lib/hour'
import styles from './RotationHourStepper.module.css'

interface RotationHourStepperProps {
  hour: number
  onChange: (hour: number) => void
}

export function RotationHourStepper({ hour, onChange }: RotationHourStepperProps) {
  return (
    <div className={styles.stepper}>
      <button type="button" className={styles.step} aria-label="Earlier hour" onClick={() => onChange((hour + 23) % 24)}>
        <MinusIcon aria-hidden />
      </button>
      <div className={styles.readout}>
        <span className={styles.label}>{formatHourLabel(hour)}</span>
        <span className={styles.tag}>local</span>
      </div>
      <button type="button" className={styles.step} aria-label="Later hour" onClick={() => onChange((hour + 1) % 24)}>
        <PlusIcon aria-hidden />
      </button>
    </div>
  )
}
```

`apps/web/src/components/RotationHourStepper.module.css`:

```css
.stepper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: 11px;
  border: 1px solid var(--hairline);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}

.readout {
  flex: 1;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  height: 46px;
  border-radius: 11px;
  border: 1px solid var(--hairline);
  background: var(--surface-2);
}

.label {
  font-size: 19px;
  font-weight: 600;
}

.tag {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-faint);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/RotationHourStepper.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint + commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check
git add apps/web/src/components/RotationHourStepper.tsx apps/web/src/components/RotationHourStepper.module.css apps/web/src/components/RotationHourStepper.test.tsx
git commit -m "feat(web): RotationHourStepper"
```

---

## Task 6: `TimezoneField` component

**Files:**
- Create: `apps/web/src/components/TimezoneField.tsx`, `apps/web/src/components/TimezoneField.module.css`
- Test: `apps/web/src/components/TimezoneField.test.tsx`

**Interfaces:**
- Consumes: `validateTimezone` (Task 2).
- Produces: `TimezoneField({ value, onChange, detectedZone })` where `value: string`, `onChange: (v: string) => void`, `detectedZone: string`. Renders the label, mono input, and one of three hints. Validity is a pure function of `value`, so the parent (Task 10) gates submit by calling `validateTimezone` itself — no callback needed. Consumed by Task 10.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/TimezoneField.test.tsx`:

```tsx
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
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/TimezoneField.test.tsx`
Expected: FAIL — cannot find module `./TimezoneField`.

- [ ] **Step 3: Implement the component + CSS**

`apps/web/src/components/TimezoneField.tsx`:

```tsx
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons'
import { useId } from 'react'
import { validateTimezone } from '../lib/timezone'
import styles from './TimezoneField.module.css'

interface TimezoneFieldProps {
  value: string
  onChange: (value: string) => void
  detectedZone: string
}

export function TimezoneField({ value, onChange, detectedZone }: TimezoneFieldProps) {
  const id = useId()
  const valid = validateTimezone(value)
  const hint = !valid
    ? 'Use an IANA zone like America/New_York.'
    : value === detectedZone
      ? 'Detected from your device.'
      : 'Looks good.'

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        Time zone
      </label>
      <input
        id={id}
        className={styles.input}
        value={value}
        placeholder="America/New_York"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => onChange(e.target.value)}
      />
      <p className={valid ? styles.hintOk : styles.hintBad}>
        {valid ? <CheckIcon aria-hidden /> : <Cross2Icon aria-hidden />}
        <span>{hint}</span>
      </p>
    </div>
  )
}
```

`apps/web/src/components/TimezoneField.module.css`:

```css
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label {
  font-size: 14px;
  font-weight: 600;
}

.input {
  width: 100%;
  height: 46px;
  border-radius: 11px;
  border: 1px solid var(--hairline);
  background: var(--surface);
  padding: 0 14px;
  font-family: var(--font-mono);
  font-size: 14px;
}

.hintOk,
.hintBad {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
}

.hintOk {
  color: var(--success);
}

.hintBad {
  color: var(--danger);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/TimezoneField.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint + commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check
git add apps/web/src/components/TimezoneField.tsx apps/web/src/components/TimezoneField.module.css apps/web/src/components/TimezoneField.test.tsx
git commit -m "feat(web): TimezoneField with validity hints"
```

---

## Task 7: `PalettePicker` component

**Files:**
- Create: `apps/web/src/components/PalettePicker.tsx`, `apps/web/src/components/PalettePicker.module.css`
- Test: `apps/web/src/components/PalettePicker.test.tsx`

**Interfaces:**
- Consumes: `PaletteSummary`, `PaletteColor` from `../lib/palette` (Task 3).
- Produces: `PalettePicker({ palettes, selectedSlug, onSelect })` where `palettes: PaletteSummary[]`, `selectedSlug: string | null` (`null` = Custom), `onSelect: (slug: string | null) => void`. Renders one row per palette + a Custom row; shows the custom note when Custom is selected. Consumed by Task 10.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/PalettePicker.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PaletteSummary } from '../lib/palette'
import { PalettePicker } from './PalettePicker'

const palettes: PaletteSummary[] = [
  {
    slug: 'rainbow',
    name: 'Rainbow Colors',
    description: 'The classic seven.',
    is_default: true,
    colors: [{ hex: '#FF2D2D', name: 'Scarlet' }],
  },
  { slug: 'cool', name: 'Cool', description: 'Blues and teals.', is_default: false, colors: [{ hex: '#2E6BFF', name: 'Cornflower' }] },
]

describe('PalettePicker', () => {
  it('lists palette names and reports a selection', async () => {
    const onSelect = vi.fn()
    render(<PalettePicker palettes={palettes} selectedSlug="rainbow" onSelect={onSelect} />)
    expect(screen.getByText('Rainbow Colors')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Cool/ }))
    expect(onSelect).toHaveBeenCalledWith('cool')
  })

  it('selects Custom (null) and reveals the note', async () => {
    const onSelect = vi.fn()
    const { rerender } = render(<PalettePicker palettes={palettes} selectedSlug="rainbow" onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: /Custom colors/ }))
    expect(onSelect).toHaveBeenCalledWith(null)
    rerender(<PalettePicker palettes={palettes} selectedSlug={null} onSelect={onSelect} />)
    expect(
      screen.getByText("Create the neighborhood first — you'll add and reorder your custom colors in Manage."),
    ).toBeInTheDocument()
  })

  it('marks the selected row', () => {
    render(<PalettePicker palettes={palettes} selectedSlug="rainbow" onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: /Rainbow Colors/ })).toHaveAttribute('aria-pressed', 'true')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/PalettePicker.test.tsx`
Expected: FAIL — cannot find module `./PalettePicker`.

- [ ] **Step 3: Implement the component + CSS**

`apps/web/src/components/PalettePicker.tsx`:

```tsx
import { CheckIcon, PlusIcon } from '@radix-ui/react-icons'
import type { PaletteColor, PaletteSummary } from '../lib/palette'
import styles from './PalettePicker.module.css'

interface PalettePickerProps {
  palettes: PaletteSummary[]
  selectedSlug: string | null // null = Custom colors
  onSelect: (slug: string | null) => void
}

const CUSTOM_NOTE = "Create the neighborhood first — you'll add and reorder your custom colors in Manage."

function Row({
  selected,
  onClick,
  name,
  description,
  children,
}: {
  selected: boolean
  onClick: () => void
  name: string
  description: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={[styles.row, selected ? styles.rowSelected : ''].filter(Boolean).join(' ')}
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        <span className={styles.desc}>{description}</span>
      </span>
      {selected && (
        <span className={styles.badge} aria-hidden>
          <CheckIcon />
        </span>
      )}
    </button>
  )
}

function Swatches({ colors }: { colors: PaletteColor[] }) {
  return (
    <span className={styles.swatches} aria-hidden>
      {colors.map((c) => (
        <span key={`${c.hex}-${c.name ?? ''}`} className={styles.swatch} style={{ background: c.hex }} />
      ))}
    </span>
  )
}

export function PalettePicker({ palettes, selectedSlug, onSelect }: PalettePickerProps) {
  return (
    <div className={styles.picker}>
      {palettes.map((p) => (
        <Row
          key={p.slug}
          selected={selectedSlug === p.slug}
          onClick={() => onSelect(p.slug)}
          name={p.name}
          description={p.description ?? ''}
        >
          <Swatches colors={p.colors} />
        </Row>
      ))}

      <Row selected={selectedSlug === null} onClick={() => onSelect(null)} name="Custom colors" description="Define your own set">
        <span className={styles.customTile} aria-hidden>
          <PlusIcon />
        </span>
      </Row>

      {selectedSlug === null && <p className={styles.note}>{CUSTOM_NOTE}</p>}
    </div>
  )
}
```

`apps/web/src/components/PalettePicker.module.css`:

```css
.picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 56px;
  padding: 12px 14px;
  text-align: left;
  border-radius: 13px;
  border: 1.5px solid var(--hairline);
  background: var(--surface);
  cursor: pointer;
}

.rowSelected {
  border-color: var(--accent);
  background: var(--surface-2);
}

.swatches {
  display: inline-flex;
  gap: 2px;
  flex-wrap: wrap;
  max-width: 130px;
}

.swatch {
  width: 15px;
  height: 24px;
  border-radius: 4px;
}

.customTile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 5px;
  border: 1.5px dashed var(--text-faint);
  color: var(--text-faint);
}

.text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.name {
  font-size: 13.5px;
  font-weight: 600;
}

.desc {
  font-size: 11.5px;
  color: var(--text-faint);
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 23px;
  height: 23px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  flex-shrink: 0;
}

.note {
  margin-top: 2px;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-faint);
  background: var(--surface-2);
  border: 1px solid var(--hairline);
  border-radius: 11px;
  padding: 12px 14px;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/PalettePicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint + commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check
git add apps/web/src/components/PalettePicker.tsx apps/web/src/components/PalettePicker.module.css apps/web/src/components/PalettePicker.test.tsx
git commit -m "feat(web): PalettePicker with Custom option"
```

---

## Task 8: `ShareCard` component

**Files:**
- Create: `apps/web/src/components/ShareCard.tsx`, `apps/web/src/components/ShareCard.module.css`
- Test: `apps/web/src/components/ShareCard.test.tsx`

**Interfaces:**
- Consumes: `colorTheme` (`../color/theme`), `Logo` (`./Logo`), `SwatchRow` (`./SwatchRow`), `PaletteColor` (`../lib/palette`).
- Produces: presentational `ShareCard` — props below. Swatch row is interactive **only** when `onPreviewColor` is passed; otherwise it renders the static `SwatchRow`. When `activeColor` is `null`, renders a neutral custom placeholder. Consumed by Task 10 (and later 2c/2d).

```ts
interface ShareCardProps {
  name: string | null
  activeColor: PaletteColor | null // null -> custom/empty placeholder
  colors: PaletteColor[]
  paletteName: string
  rotationLabel: string
  activeHex?: string // which swatch to ring; defaults to activeColor.hex
  onPreviewColor?: (hex: string | null) => void // present -> interactive swatches
}
```

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/ShareCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PaletteColor } from '../lib/palette'
import { ShareCard } from './ShareCard'

const colors: PaletteColor[] = [
  { hex: '#FF2D2D', name: 'Scarlet' },
  { hex: '#2E6BFF', name: 'Cornflower' },
]

describe('ShareCard', () => {
  it('renders the active color name and rotation label', () => {
    render(
      <ShareCard name="Maple Street" activeColor={colors[0]} colors={colors} paletteName="Rainbow Colors" rotationLabel="7:00 AM" />,
    )
    expect(screen.getByText('Scarlet')).toBeInTheDocument()
    expect(screen.getByText(/Maple Street · today/)).toBeInTheDocument()
    expect(screen.getByText('Rotates daily at 7:00 AM')).toBeInTheDocument()
  })

  it('fires onPreviewColor on hover and marks the active swatch', async () => {
    const onPreviewColor = vi.fn()
    render(
      <ShareCard
        name={null}
        activeColor={colors[1]}
        colors={colors}
        paletteName="Rainbow Colors"
        rotationLabel="7:00 AM"
        activeHex="#2E6BFF"
        onPreviewColor={onPreviewColor}
      />,
    )
    expect(screen.getByRole('button', { name: /Cornflower/ })).toHaveAttribute('data-active', 'true')
    await userEvent.hover(screen.getByRole('button', { name: /Scarlet/ }))
    expect(onPreviewColor).toHaveBeenCalledWith('#FF2D2D')
  })

  it('is static (no buttons) without onPreviewColor', () => {
    render(<ShareCard name={null} activeColor={colors[0]} colors={colors} paletteName="Rainbow Colors" rotationLabel="7:00 AM" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows the custom placeholder when there is no active color', () => {
    render(<ShareCard name="Maple" activeColor={null} colors={[]} paletteName="Custom colors" rotationLabel="7:00 AM" />)
    expect(screen.getByText('Your custom colors')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/ShareCard.test.tsx`
Expected: FAIL — cannot find module `./ShareCard`.

- [ ] **Step 3: Implement the component + CSS**

`apps/web/src/components/ShareCard.tsx`:

```tsx
import { colorTheme } from '../color/theme'
import type { PaletteColor } from '../lib/palette'
import { Logo } from './Logo'
import styles from './ShareCard.module.css'
import { SwatchRow } from './SwatchRow'

interface ShareCardProps {
  name: string | null
  activeColor: PaletteColor | null
  colors: PaletteColor[]
  paletteName: string
  rotationLabel: string
  activeHex?: string
  onPreviewColor?: (hex: string | null) => void
}

export function ShareCard({ name, activeColor, colors, paletteName, rotationLabel, activeHex, onPreviewColor }: ShareCardProps) {
  const theme = activeColor ? colorTheme(activeColor.hex) : null
  const displayName = name?.trim() ? name.trim() : 'Your neighborhood'
  const highlight = activeHex ?? activeColor?.hex

  return (
    <div className={styles.card}>
      {activeColor && theme ? (
        <div className={styles.colorPanel} style={{ background: activeColor.hex, color: theme.ink }}>
          <div className={styles.colorTop}>
            <Logo lockup={theme.lockup} height={30} />
            <span className={styles.hexChip} style={{ background: theme.chipBg }}>
              {activeColor.hex}
            </span>
          </div>
          <div>
            <p className={styles.eyebrow}>{displayName} · today</p>
            <p className={styles.colorName}>{activeColor.name ?? activeColor.hex}</p>
          </div>
        </div>
      ) : (
        <div className={styles.customPanel}>
          <p className={styles.customText}>Your custom colors</p>
          <p className={styles.customSub}>You'll add them in Manage</p>
        </div>
      )}

      <div className={styles.infoPanel}>
        <div>
          <p className={styles.paletteName}>{paletteName}</p>
          {onPreviewColor ? (
            <div className={styles.swatchRow} role="group" aria-label="Palette colors — hover to preview">
              {colors.map((c) => (
                <button
                  key={`${c.hex}-${c.name ?? ''}`}
                  type="button"
                  className={styles.swatch}
                  style={{ background: c.hex }}
                  data-active={c.hex === highlight || undefined}
                  aria-label={c.name ? `${c.name} ${c.hex}` : c.hex}
                  onMouseEnter={() => onPreviewColor(c.hex)}
                  onFocus={() => onPreviewColor(c.hex)}
                  onMouseLeave={() => onPreviewColor(null)}
                  onBlur={() => onPreviewColor(null)}
                />
              ))}
            </div>
          ) : (
            colors.length > 0 && <SwatchRow colors={colors} />
          )}
        </div>
        <p className={styles.rotates}>Rotates daily at {rotationLabel}</p>
      </div>
    </div>
  )
}
```

`apps/web/src/components/ShareCard.module.css`:

```css
.card {
  display: flex;
  flex-wrap: wrap;
  border-radius: 22px;
  overflow: hidden;
  border: 1px solid var(--hairline);
  box-shadow: var(--shadow-card);
}

.colorPanel,
.customPanel {
  flex: 1 1 200px;
  min-height: 260px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: background 0.5s ease, color 0.5s ease;
}

.customPanel {
  background: var(--surface-2);
  color: var(--text);
  gap: 8px;
  justify-content: center;
}

.customText {
  font-size: 20px;
  font-weight: 600;
}

.customSub {
  font-size: 13px;
  color: var(--text-faint);
}

.colorTop {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.hexChip {
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 7px;
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  opacity: 0.85;
}

.colorName {
  font-size: 40px;
  font-weight: 600;
  letter-spacing: -0.03em;
  margin-top: 6px;
}

.infoPanel {
  flex: 1 1 180px;
  background: var(--surface);
  padding: 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
}

.paletteName {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

.swatchRow {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.swatch {
  width: 15px;
  height: 24px;
  border-radius: 5px;
  border: 0;
  padding: 0;
  cursor: pointer;
}

.swatch[data-active] {
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent);
}

.rotates {
  font-size: 12.5px;
  color: var(--text-faint);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/ShareCard.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck + lint + commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check
git add apps/web/src/components/ShareCard.tsx apps/web/src/components/ShareCard.module.css apps/web/src/components/ShareCard.test.tsx
git commit -m "feat(web): ShareCard preview component"
```

---

## Task 9: `CreateSuccess` component

**Files:**
- Create: `apps/web/src/components/CreateSuccess.tsx`, `apps/web/src/components/CreateSuccess.module.css`
- Test: `apps/web/src/components/CreateSuccess.test.tsx`

**Interfaces:**
- Consumes: `CreatedNeighborhood` (`@neighborhue/api/types`), `CopyButton` (`./CopyButton`), `Link` (`@tanstack/react-router`).
- Produces: `CreateSuccess({ created })` where `created: CreatedNeighborhood`. Renders both link rows + copy, the amber warning, and the two CTAs. Share URL is `https://neighborhue.app/n/{id}`; the manage CTA is `Link to="/manage/$id" params hash={admin_secret}`. Consumed by Task 10.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/CreateSuccess.test.tsx`:

```tsx
import type { CreatedNeighborhood } from '@neighborhue/api/types'
import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CreateSuccess } from './CreateSuccess'

// Rich Link mock: interpolate params and append the hash so we can assert real URLs.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, hash, ...rest }: ComponentProps<'a'> & { to?: string; params?: Record<string, string>; hash?: string }) => {
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
      screen.getByText("Save this link — it's the only way back in. There are no accounts, and it can't be recovered if lost."),
    ).toBeInTheDocument()
  })

  it('links the CTAs to the share and manage URLs', () => {
    render(<CreateSuccess created={created} />)
    expect(screen.getByRole('link', { name: /Open share page/ })).toHaveAttribute('href', '/n/abc123')
    expect(screen.getByRole('link', { name: /Go to manage/ })).toHaveAttribute('href', '/manage/abc123#nh_sk_secret')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/CreateSuccess.test.tsx`
Expected: FAIL — cannot find module `./CreateSuccess`.

- [ ] **Step 3: Implement the component + CSS**

`apps/web/src/components/CreateSuccess.tsx`:

```tsx
import type { CreatedNeighborhood } from '@neighborhue/api/types'
import { CheckCircledIcon, ExclamationTriangleIcon, EyeOpenIcon, GearIcon, LockClosedIcon } from '@radix-ui/react-icons'
import { Link } from '@tanstack/react-router'
import { CopyButton } from './CopyButton'
import styles from './CreateSuccess.module.css'

interface CreateSuccessProps {
  created: CreatedNeighborhood
}

export function CreateSuccess({ created }: CreateSuccessProps) {
  const shareUrl = `https://neighborhue.app/n/${created.id}`

  return (
    <div className={styles.card}>
      <div className={styles.check} aria-hidden>
        <CheckCircledIcon width={28} height={28} />
      </div>
      <h2 className={styles.title}>Your neighborhood is live</h2>
      <p className={styles.body}>
        Share the public link with your neighbors. Keep the management link somewhere safe — it's how you get back in.
      </p>

      <div className={styles.block}>
        <p className={styles.label}>Public share link</p>
        <div className={styles.linkRow}>
          <span className={styles.url}>{shareUrl}</span>
          <CopyButton value={shareUrl} label="Copy" />
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.label}>
          <LockClosedIcon aria-hidden /> Private management link
        </p>
        <div className={styles.linkRow}>
          <span className={styles.url}>{created.manage_url}</span>
          <CopyButton value={created.manage_url} label="Copy" />
        </div>
        <p className={styles.warning}>
          <ExclamationTriangleIcon aria-hidden />
          <span>Save this link — it's the only way back in. There are no accounts, and it can't be recovered if lost.</span>
        </p>
      </div>

      <div className={styles.actions}>
        <Link to="/n/$id" params={{ id: created.id }} className={styles.primary}>
          <EyeOpenIcon aria-hidden /> Open share page
        </Link>
        <Link to="/manage/$id" params={{ id: created.id }} hash={created.admin_secret} className={styles.secondary}>
          <GearIcon aria-hidden /> Go to manage
        </Link>
      </div>
    </div>
  )
}
```

`apps/web/src/components/CreateSuccess.module.css`:

```css
.card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: 20px;
  padding: 30px;
  box-shadow: var(--shadow-card);
}

.check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--success-tint);
  color: var(--success);
}

.title {
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.body {
  font-size: 14px;
  line-height: 1.55;
  color: var(--text-muted);
}

.block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}

.linkRow {
  display: flex;
  align-items: center;
  gap: 10px;
}

.url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 13px;
  background: var(--surface-2);
  border: 1px solid var(--hairline);
  border-radius: 11px;
  padding: 10px 12px;
}

.warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--warning);
  background: var(--warning-tint);
  border: 1px solid var(--warning);
  border-radius: 11px;
  padding: 12px 14px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
}

.primary,
.secondary {
  flex: 1;
  min-width: 150px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  border-radius: 12px;
  font-weight: 600;
  text-decoration: none;
}

.primary {
  background: var(--cta-bg);
  color: var(--cta-fg);
}

.secondary {
  background: var(--surface);
  border: 1px solid var(--hairline);
  color: var(--text);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/CreateSuccess.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint + commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check
git add apps/web/src/components/CreateSuccess.tsx apps/web/src/components/CreateSuccess.module.css apps/web/src/components/CreateSuccess.test.tsx
git commit -m "feat(web): CreateSuccess card"
```

---

## Task 10: `CreateView` orchestrator

**Files:**
- Create: `apps/web/src/components/CreateView.tsx`, `apps/web/src/components/CreateView.module.css`
- Test: `apps/web/src/components/CreateView.test.tsx`

**Interfaces:**
- Consumes: `PaletteSummary`, `PaletteColor` (`../lib/palette`), `CreateBody`, `CreatedNeighborhood`, `formatHourLabel`, `validateTimezone`, `usePaletteCycle`, and all of `RotationHourStepper`, `TimezoneField`, `PalettePicker`, `ShareCard`, `CreateSuccess`, `Link`.
- Produces: `CreateView` (props below). Owns form state + preview interaction; calls `onCreate` with the assembled body; renders `CreateSuccess` when `created` is set.

```ts
interface CreateViewProps {
  palettes: PaletteSummary[]
  initialTimezone: string
  onCreate: (body: CreateBody) => void
  pending: boolean
  error: string | null
  created: CreatedNeighborhood | null
}
```

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/CreateView.test.tsx`:

```tsx
import type { CreatedNeighborhood } from '@neighborhue/api/types'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { PaletteSummary } from '../lib/palette'
import { CreateView } from './CreateView'

vi.mock('../hooks/usePaletteCycle', () => ({ usePaletteCycle: () => 0 }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: ComponentProps<'a'> & { to?: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

const palettes: PaletteSummary[] = [
  {
    slug: 'rainbow',
    name: 'Rainbow Colors',
    description: 'The classic seven.',
    is_default: true,
    colors: [{ hex: '#FF2D2D', name: 'Scarlet' }],
  },
  { slug: 'cool', name: 'Cool', description: 'Blues and teals.', is_default: false, colors: [{ hex: '#2E6BFF', name: 'Cornflower' }] },
]

function setup(overrides: Partial<ComponentProps<typeof CreateView>> = {}) {
  const onCreate = vi.fn()
  render(
    <CreateView
      palettes={palettes}
      initialTimezone="America/New_York"
      onCreate={onCreate}
      pending={false}
      error={null}
      created={null}
      {...overrides}
    />,
  )
  return { onCreate }
}

describe('CreateView', () => {
  it('submits the assembled body with the default palette', async () => {
    const { onCreate } = setup()
    await userEvent.type(screen.getByLabelText(/Neighborhood name/), 'Maple Street')
    await userEvent.click(screen.getByRole('button', { name: /Create neighborhood/ }))
    expect(onCreate).toHaveBeenCalledWith({ name: 'Maple Street', timezone: 'America/New_York', rotation_hour: 7, palette: 'rainbow' })
  })

  it('omits palette when Custom is selected', async () => {
    const { onCreate } = setup()
    await userEvent.click(screen.getByRole('button', { name: /Custom colors/ }))
    await userEvent.click(screen.getByRole('button', { name: /Create neighborhood/ }))
    expect(onCreate).toHaveBeenCalledWith({ timezone: 'America/New_York', rotation_hour: 7 })
  })

  it('disables submit on an invalid timezone', async () => {
    setup()
    const tz = screen.getByLabelText('Time zone')
    await userEvent.clear(tz)
    await userEvent.type(tz, 'Mars/Base')
    expect(screen.getByRole('button', { name: /Create neighborhood/ })).toBeDisabled()
  })

  it('shows the error message and keeps the form', () => {
    setup({ error: 'Something went wrong' })
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByLabelText(/Neighborhood name/)).toBeInTheDocument()
  })

  it('renders the success card instead of the form once created', () => {
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
    setup({ created })
    expect(screen.getByText('Your neighborhood is live')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Neighborhood name/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/CreateView.test.tsx`
Expected: FAIL — cannot find module `./CreateView`.

- [ ] **Step 3: Implement the component + CSS**

`apps/web/src/components/CreateView.tsx`:

```tsx
import type { CreatedNeighborhood } from '@neighborhue/api/types'
import { ArrowLeftIcon, ArrowRightIcon } from '@radix-ui/react-icons'
import { Link } from '@tanstack/react-router'
import { useId, useMemo, useState } from 'react'
import { usePaletteCycle } from '../hooks/usePaletteCycle'
import { formatHourLabel } from '../lib/hour'
import type { CreateBody } from '../lib/neighborhood'
import type { PaletteColor, PaletteSummary } from '../lib/palette'
import { validateTimezone } from '../lib/timezone'
import { CreateSuccess } from './CreateSuccess'
import styles from './CreateView.module.css'
import { PalettePicker } from './PalettePicker'
import { RotationHourStepper } from './RotationHourStepper'
import { ShareCard } from './ShareCard'
import { TimezoneField } from './TimezoneField'

interface CreateViewProps {
  palettes: PaletteSummary[]
  initialTimezone: string
  onCreate: (body: CreateBody) => void
  pending: boolean
  error: string | null
  created: CreatedNeighborhood | null
}

export function CreateView({ palettes, initialTimezone, onCreate, pending, error, created }: CreateViewProps) {
  const nameId = useId()
  const defaultSlug = useMemo(() => palettes.find((p) => p.is_default)?.slug ?? palettes[0]?.slug ?? null, [palettes])

  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState(initialTimezone)
  const [hour, setHour] = useState(7)
  const [paletteSlug, setPaletteSlug] = useState<string | null>(defaultSlug)
  const [hoveredHex, setHoveredHex] = useState<string | null>(null)

  const selected = paletteSlug ? palettes.find((p) => p.slug === paletteSlug) : undefined
  const colors: PaletteColor[] = selected?.colors ?? []
  const cycleIndex = usePaletteCycle(colors.length)
  const activeColor: PaletteColor | null =
    colors.length === 0 ? null : (hoveredHex ? colors.find((c) => c.hex === hoveredHex) : colors[cycleIndex]) ?? colors[0]

  const tzValid = validateTimezone(timezone)

  function submit() {
    const body: CreateBody = { timezone, rotation_hour: hour }
    if (name.trim()) body.name = name.trim()
    if (paletteSlug) body.palette = paletteSlug
    onCreate(body)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        {/* Neutral-chrome logo: swap the lockup by system theme in pure CSS
            (the ink-based Logo is only right on the colored panel). */}
        <Link to="/" aria-label="Neighborhue home" className={styles.logo} />
        <Link to="/" className={styles.back}>
          <ArrowLeftIcon aria-hidden /> Back
        </Link>
      </header>

      <main className={styles.main}>
        <h1 className={styles.h1}>Create a neighborhood</h1>
        <p className={styles.subhead}>
          Spin one up in under a minute. No account, no email — ownership is just the secret link you'll get at the end.
        </p>

        <div className={styles.columns}>
          <div className={styles.left}>
            {created ? (
              <CreateSuccess created={created} />
            ) : (
              <div className={styles.formCard}>
                <div className={styles.field}>
                  <label htmlFor={nameId} className={styles.label}>
                    Neighborhood name <span className={styles.optional}>optional</span>
                  </label>
                  <input
                    id={nameId}
                    className={styles.input}
                    value={name}
                    maxLength={120}
                    placeholder="e.g. Maple Street"
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <TimezoneField value={timezone} onChange={setTimezone} detectedZone={initialTimezone} />

                <div className={styles.field}>
                  <span className={styles.label}>Rotation hour</span>
                  <RotationHourStepper hour={hour} onChange={setHour} />
                  <p className={styles.help}>The color flips at this time each morning.</p>
                </div>

                <div className={styles.field}>
                  <span className={styles.label}>Palette</span>
                  <PalettePicker palettes={palettes} selectedSlug={paletteSlug} onSelect={setPaletteSlug} />
                </div>

                {error && <p className={styles.error}>{error}</p>}

                <button type="button" className={styles.submit} disabled={pending || !tzValid} onClick={submit}>
                  {pending ? 'Creating…' : 'Create neighborhood'}
                  {!pending && <ArrowRightIcon aria-hidden />}
                </button>
              </div>
            )}
          </div>

          <div className={styles.right}>
            <p className={styles.previewEyebrow}>Live preview</p>
            <ShareCard
              name={name}
              activeColor={activeColor}
              colors={colors}
              paletteName={selected?.name ?? 'Custom colors'}
              rotationLabel={formatHourLabel(hour)}
              activeHex={activeColor?.hex}
              onPreviewColor={setHoveredHex}
            />
            <p className={styles.previewCaption}>
              Updates as you edit. The real color is deterministic from the neighborhood + the day.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
```

`apps/web/src/components/CreateView.module.css`:

```css
.page {
  min-height: 100vh;
  background: var(--page-bg);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1180px;
  margin: 0 auto;
  padding: 24px 30px;
}

.logo {
  display: block;
  width: 170px;
  height: 44px;
  background: url("/lockup-dark-text.png") left center / contain no-repeat;
}

@media (prefers-color-scheme: dark) {
  .logo {
    background-image: url("/lockup-light.png");
  }
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 13px;
  border-radius: 9px;
  font-weight: 600;
  font-size: 14px;
  color: var(--text-muted);
  text-decoration: none;
}

.main {
  max-width: 1120px;
  margin: 0 auto;
  padding: 8px 30px 120px;
}

.h1 {
  font-size: 36px;
  font-weight: 600;
  letter-spacing: -0.03em;
}

.subhead {
  margin-top: 10px;
  max-width: 600px;
  font-size: 15px;
  color: var(--text-muted);
}

.columns {
  display: flex;
  flex-wrap: wrap;
  gap: 32px;
  align-items: flex-start;
  margin-top: 30px;
}

.left {
  flex: 1 1 440px;
  min-width: 320px;
}

.right {
  flex: 1 1 360px;
  min-width: 300px;
  position: sticky;
  top: 24px;
}

.formCard {
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: 20px;
  padding: 30px;
  box-shadow: var(--shadow-card);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label {
  font-size: 14px;
  font-weight: 600;
}

.optional {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
  background: var(--surface-2);
  padding: 2px 7px;
  border-radius: 5px;
}

.input {
  width: 100%;
  height: 46px;
  border-radius: 11px;
  border: 1px solid var(--hairline);
  background: var(--surface);
  padding: 0 14px;
  font-size: 14.5px;
}

.help {
  font-size: 12px;
  color: var(--text-faint);
}

.error {
  font-size: 13px;
  color: var(--danger);
}

.submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 52px;
  border: 0;
  border-radius: 13px;
  background: var(--cta-bg);
  color: var(--cta-fg);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.previewEyebrow {
  font-family: var(--font-mono);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-faint);
  margin-bottom: 12px;
}

.previewCaption {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-faint);
  text-align: center;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/CreateView.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck + lint + commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check
git add apps/web/src/components/CreateView.tsx apps/web/src/components/CreateView.module.css apps/web/src/components/CreateView.test.tsx
git commit -m "feat(web): CreateView form + preview orchestrator"
```

---

## Task 11: `/create` route wiring

**Files:**
- Modify: `apps/web/src/routes/create.tsx`

**Interfaces:**
- Consumes: `palettesQueryOptions` (`../lib/queries`), `createNeighborhood`/`CreateBody` (`../lib/neighborhood`), `API_URL` (`../lib/config`), `CreatedNeighborhood` (`@neighborhue/api/types`), `CreateView` (Task 10).
- Produces: the real `/create` route (still `ssr:false`). Verified by typecheck + build + the full suite; no route-level unit test (matches the 2a route pattern — routes are thin data shells).

- [ ] **Step 1: Replace the stub with the real route**

`apps/web/src/routes/create.tsx`:

```tsx
import type { CreatedNeighborhood } from '@neighborhue/api/types'
import { useMutation, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { CreateView } from '../components/CreateView'
import { API_URL } from '../lib/config'
import { createNeighborhood, type CreateBody } from '../lib/neighborhood'
import { palettesQueryOptions } from '../lib/queries'

// ssr:false — the timezone default comes from Intl in the browser; SSR would
// render a wrong default and hydrate over it (spec C12). The loader still runs
// client-side to prime the palettes cache before the picker reads it.
export const Route = createFileRoute('/create')({
  ssr: false,
  loader: ({ context }) => context.queryClient.ensureQueryData(palettesQueryOptions()),
  component: CreatePage,
})

function CreatePage() {
  const { data: palettes } = useSuspenseQuery(palettesQueryOptions())
  const [created, setCreated] = useState<CreatedNeighborhood | null>(null)
  // Held in state only — the secret is shown once and never persisted (spec C5).
  const [initialTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)

  const mutation = useMutation({
    mutationFn: (body: CreateBody) => createNeighborhood(API_URL, body),
    onSuccess: setCreated,
  })

  return (
    <CreateView
      palettes={palettes}
      initialTimezone={initialTimezone}
      onCreate={(body) => mutation.mutate(body)}
      pending={mutation.isPending}
      error={mutation.error ? mutation.error.message : null}
      created={created}
    />
  )
}
```

- [ ] **Step 2: Typecheck the web app**

Run: `pnpm -F @neighborhue/web typecheck`
Expected: PASS.

- [ ] **Step 3: Build to confirm the route compiles + bundles**

Run: `pnpm -F @neighborhue/web build`
Expected: build succeeds (no route/type errors).

- [ ] **Step 4: Run the full web suite + lint**

Run: `pnpm -F @neighborhue/web test && pnpm check`
Expected: all web tests PASS, Biome clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/create.tsx
git commit -m "feat(web): wire the real /create route"
```

---

## Final verification (after Task 11)

- [ ] Run the whole monorepo: `pnpm typecheck && pnpm test && pnpm check` — everything green.
- [ ] Manual (local `pnpm -F @neighborhue/web dev`, or post-deploy): `/create` renders the form + live cycling preview; hovering a swatch pins the color; submitting creates a neighborhood and swaps to the success card; "Open share page" reaches the real `/n/{id}` with today's color; "Go to manage" points at `/manage/{id}#{secret}`. Delete any test neighborhood created (DELETE with its `admin_secret`).
- [ ] Whole-branch review via subagent-driven-development's final review gate.

---

## Notes for the implementer

- **`useMutation`/`useSuspenseQuery`/`Link`** are unit-tested only where a component owns them via props; the route itself (Task 11) is verified by typecheck + build, exactly like `routes/n.$id.tsx` in 2a.
- **Do not add a route-level RTL test** — TanStack Start routes need a real `RouterProvider` + `QueryClientProvider`; the whole point of `CreateView` (Task 10) is to make the flow testable without them.
- **`routeTree.gen.ts` needs no manual edit** — `/create` already exists in the tree (only its component body changes).
- **Radix icon names used:** `MinusIcon`, `PlusIcon`, `CheckIcon`, `Cross2Icon`, `CheckCircledIcon`, `ExclamationTriangleIcon`, `EyeOpenIcon`, `GearIcon`, `LockClosedIcon`, `ArrowLeftIcon`, `ArrowRightIcon` — all from `@radix-ui/react-icons` (already a dependency).
