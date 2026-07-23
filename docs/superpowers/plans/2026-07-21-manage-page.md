# Manage Page (Spec 2c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/manage/:id` stub with the real admin screen — secret-authenticated editing (name, timezone, rotation hour, palette, custom colors) with auto-save, a live real-color preview, and a confirmed delete.

**Architecture:** The route (`routes/manage.$id.tsx`, `ssr:false`) is the data container: it reads the fragment secret, runs the three reads (config/public-color/palettes) and the save/delete mutations, and renders the loading/auth/not-found/deleted states — then hands loaded data + callbacks to a presentational `ManageView` that owns the form state, auto-save commits, the custom-colors editor, and the delete dialog. Every other unit is pure/props-driven and independently tested, matching the 2a/2b pattern (the route has no unit test; the flow is tested via `ManageView`).

**Tech Stack:** React 19, TanStack Start/Router/Query, Radix Primitives (`Dialog` — new; `Collapsible` via `HaPanel`), Radix Icons, CSS Modules + Radix Colors tokens, Hono (`hc`) typed client with Bearer auth, Vitest + Testing Library + happy-dom, Biome, pnpm.

## Global Constraints

- **API wins** wherever it disagrees with the handoff.
- **Secret handling (M3):** read from `window.location.hash.slice(1)`; send only as `Authorization: Bearer {secret}`; hold in memory only — never SSR'd, logged, persisted, or put in a Query key. Route stays `ssr:false`.
- **Auto-save on commit (M1):** discrete actions (palette pick, hour ±, add/remove/reorder a custom color) save immediately; text fields (name, timezone) save on blur. Reflect the PATCH response (no optimistic rollback). A page-level indicator shows Saving/Saved/error.
- **Palette ⊻ custom (M2):** curated pick saves `{ palette: slug, custom_colors: null }`; custom edit saves `{ palette: null, custom_colors: [...] }`; removing the last custom color saves `{ custom_colors: null }`. On load, non-empty `custom_colors` ⇒ Custom mode. Selecting Custom with an empty list is a transient UI state (no PATCH until the first color).
- **Hex is 6-digit only (M9):** `/^#[0-9A-Fa-f]{6}$/`, matching the API's `HEX_RE`. Error copy: `Enter a valid hex like #FF6A00.` Blank name defaults to `Custom`.
- **Links (C6, carried):** public share URL is `https://neighborhue.app/n/{id}`; "View public page" → `/n/:id`.
- **Preview (M6):** real today-color from the public read; name/rotation update labels locally; after a palette/custom save, refetch the public read; NO "Preview another day".
- **Delete (M7):** Radix `Dialog` confirm → `DELETE` → inline deleted state with a `/create` CTA (do NOT redirect to the Home stub).
- **Verbatim copy** (handoff §4): title `Manage`; secret chip `Secret link`; nav `View public page`; card headings `Details` / `Palette` / `Share & connect`; labels `Neighborhood name` / `Time zone` / `Rotation hour` / `Public share link` / `Custom colors`; subtitle `You're editing {name} via its private link. Changes are live for everyone immediately.`; custom empty `No custom colors yet` + `Add your first color below — it'll join the daily rotation.`; hex error `Enter a valid hex like #FF6A00.`; add placeholders `#FF6A00` / `Color name`; danger heading `Delete neighborhood`; danger subcopy `Permanently removes it. Neighbors' lights stop updating.`; danger button `Delete`; modal title `Delete {name}?`; modal body `This permanently removes the neighborhood. Neighbors' lights will stop updating and the link will 404. This can't be undone.`; modal buttons `Cancel` / `Delete`; deleted state `This neighborhood was deleted` + `Create a new one`; preview eyebrow `Live preview · today`.
- **Only existing CSS tokens** from `styles/tokens.css` — do NOT modify `tokens.css`. Danger uses `--danger`/`--danger-tint`; secret chip + amber uses `--warning`/`--warning-tint`; success uses `--success`/`--success-tint`. All dark-safe.
- **Hit targets ≥44px**; a11y carries 2b's pattern (`aria-invalid`/`aria-describedby` on validated inputs, `aria-live` on the save indicator, labelled icon buttons).
- **Tests:** `vi.mock('@tanstack/react-router')` for `Link`; the Bearer client mocked via `./client` (like 2b's `createNeighborhood` test); fake timers only where time is involved.
- **Every commit ends with the trailer:**
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```
- **Commands:** web tests `pnpm -F @neighborhue/web test`; single file `pnpm -F @neighborhue/web exec vitest run <path>`; web types `pnpm -F @neighborhue/web typecheck`; web build `pnpm -F @neighborhue/web build`; api tests `pnpm -F @neighborhue/api test`; api types `pnpm -F @neighborhue/api typecheck`; lint `pnpm check` (fix `pnpm check:fix`).

---

## File Structure

**apps/api (Task 1):** modify `src/types.ts` (+`ManageConfig`), `src/routes/neighborhoods.ts` (`serializeConfig` `satisfies` + typed `custom_colors`), `test/api.manage.test.ts` (round-trip assertion).

**apps/web:**
- `src/lib/hex.ts` (+test) — `validateHex`. *(Task 2)*
- `src/lib/manage.ts` (+test) — `fetchManageConfig`/`patchNeighborhood`/`deleteNeighborhood`, `ManagePatch`, `classifyManageError`. *(Task 3)*
- `src/lib/queries.ts` (modify) — `manageConfigQueryOptions`. *(Task 3)*
- `src/components/TimezoneField.tsx` (modify, +test) — `hideValidHint` prop. *(Task 4)*
- `src/components/CustomColorsEditor.tsx` (+css, +test). *(Task 5)*
- `src/components/SaveIndicator.tsx` (+css, +test). *(Task 6)*
- `src/components/DeleteDialog.tsx` (+css, +test) + install `@radix-ui/react-dialog`. *(Task 7)*
- `src/components/ManageView.tsx` (+css, +test). *(Task 8)*
- `src/routes/manage.$id.tsx` (modify — real container). *(Task 9)*

---

## Task 1: API — `ManageConfig` type + `satisfies`

**Files:**
- Modify: `apps/api/src/types.ts`
- Modify: `apps/api/src/routes/neighborhoods.ts:54-69` (`serializeConfig`)
- Test: `apps/api/test/api.manage.test.ts`

**Interfaces:**
- Produces: `ManageConfig` (exported from `@neighborhue/api/types`) — consumed by web Task 3.

- [ ] **Step 1: Add the custom-colors round-trip test**

In `apps/api/test/api.manage.test.ts`, inside `describe('GET/PATCH/DELETE management')`, add:

```ts
it('round-trips custom_colors as an array of {hex,name}', async () => {
  const nb = await fresh()
  const patched = await SELF.fetch(`https://x/v1/neighborhoods/${nb.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${nb.admin_secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ custom_colors: [{ hex: '#FF6A00', name: 'Tangerine' }] }),
  })
  expect(patched.status).toBe(200)
  const cfg = (await patched.json()) as { custom_colors: Array<{ hex: string; name?: string }> | null }
  expect(cfg.custom_colors).toEqual([{ hex: '#FF6A00', name: 'Tangerine' }])
})
```

- [ ] **Step 2: Run it to verify it passes already (behavior exists; this pins the shape)**

Run: `pnpm -F @neighborhue/api exec vitest run test/api.manage.test.ts`
Expected: PASS (the endpoint already round-trips custom_colors; this test locks the contract the type will describe).

- [ ] **Step 3: Add the `ManageConfig` type**

In `apps/api/src/types.ts`, after `CreatedNeighborhood`, add:

```ts
// Shape returned by GET /v1/neighborhoods/:id/manage and PATCH /v1/neighborhoods/:id
// (serializeConfig). Exported so apps/web imports (not restates) it — the same
// compile-time seam as PublicNeighborhood / CreatedNeighborhood.
export interface ManageConfig {
  id: string
  name: string | null
  timezone: string
  rotation_hour: number
  palette: string | null
  custom_colors: Array<{ hex: string; name?: string }> | null
}
```

- [ ] **Step 4: Make `serializeConfig` `satisfies ManageConfig`**

In `apps/api/src/routes/neighborhoods.ts`, update the import on line 21 to include the type:

```ts
import type { AppEnv, CreatedNeighborhood, ManageConfig, PublicNeighborhood } from '../types'
```

Then change `serializeConfig`'s return (lines 61-68) — type the `JSON.parse` and assert the shape:

```ts
  return {
    id: nb.id,
    name: nb.name,
    timezone: nb.timezone,
    rotation_hour: nb.rotationHour,
    palette: paletteSlug,
    custom_colors: nb.customColors ? (JSON.parse(nb.customColors) as Array<{ hex: string; name?: string }>) : null,
  } satisfies ManageConfig
```

- [ ] **Step 5: Typecheck + full API suite + lint**

Run: `pnpm -F @neighborhue/api typecheck && pnpm -F @neighborhue/api test && pnpm check`
Expected: typecheck clean, all API tests pass, Biome clean.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/types.ts apps/api/src/routes/neighborhoods.ts apps/api/test/api.manage.test.ts
git commit -m "feat(api): ManageConfig type for the manage/patch response"
```

---

## Task 2: Web — `validateHex`

**Files:**
- Create: `apps/web/src/lib/hex.ts`
- Test: `apps/web/src/lib/hex.test.ts`

**Interfaces:**
- Produces: `validateHex(hex: string): boolean` — 6-digit `#RRGGBB` only. Consumed by Task 5.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/hex.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { validateHex } from './hex'

describe('validateHex', () => {
  it('accepts 6-digit hex (either case)', () => {
    expect(validateHex('#FF6A00')).toBe(true)
    expect(validateHex('#ff6a00')).toBe(true)
  })
  it('rejects 3-digit shorthand, missing hash, and garbage', () => {
    expect(validateHex('#F60')).toBe(false)
    expect(validateHex('FF6A00')).toBe(false)
    expect(validateHex('#GG6A00')).toBe(false)
    expect(validateHex('')).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @neighborhue/web exec vitest run src/lib/hex.test.ts`
Expected: FAIL — cannot find module `./hex`.

- [ ] **Step 3: Implement**

`apps/web/src/lib/hex.ts`:

```ts
// 6-digit #RRGGBB only — matches the API's HEX_RE (/^#[0-9A-Fa-f]{6}$/) and its
// hexToRgb, which assumes 6 digits. The handoff's 3-digit "#F60" shorthand is
// rejected here for client↔API parity (spec M9).
const HEX_RE = /^#[0-9A-Fa-f]{6}$/

export function validateHex(hex: string): boolean {
  return HEX_RE.test(hex)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -F @neighborhue/web exec vitest run src/lib/hex.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint + commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check
git add apps/web/src/lib/hex.ts apps/web/src/lib/hex.test.ts
git commit -m "feat(web): validateHex (6-digit, API parity)"
```

---

## Task 3: Web — manage client + query + error classifier

**Files:**
- Create: `apps/web/src/lib/manage.ts`
- Modify: `apps/web/src/lib/queries.ts`
- Test: `apps/web/src/lib/manage.test.ts`

**Interfaces:**
- Consumes: `ManageConfig` from `@neighborhue/api/types` (Task 1); `createClient` from `./client`; `ApiError`, `NeighborhoodNotFound`, `parseApiErrorBody` from `./errors`.
- Produces:
  - `interface CustomColor { hex: string; name?: string }` (the custom-color shape, matching `ManageConfig.custom_colors`'s element)
  - `interface ManagePatch { name?: string | null; timezone?: string; rotation_hour?: number; palette?: string | null; custom_colors?: CustomColor[] | null }`
  - `fetchManageConfig(baseUrl, id, secret): Promise<ManageConfig>`
  - `patchNeighborhood(baseUrl, id, secret, patch: ManagePatch): Promise<ManageConfig>`
  - `deleteNeighborhood(baseUrl, id, secret): Promise<void>`
  - `classifyManageError(err: unknown): 'invalid-link' | 'not-found' | 'error'`
  - `manageConfigQueryOptions(id, secret)` (in `queries.ts`) — consumed by Task 9.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/manage.test.ts`:

```ts
import type { ManageConfig } from '@neighborhue/api/types'
import { describe, expect, it, vi } from 'vitest'
import { createClient } from './client'
import { ApiError, NeighborhoodNotFound } from './errors'
import { classifyManageError, deleteNeighborhood, fetchManageConfig, patchNeighborhood } from './manage'

vi.mock('./client', () => ({ createClient: vi.fn() }))

const config: ManageConfig = {
  id: 'abc',
  name: 'Maple Street',
  timezone: 'America/New_York',
  rotation_hour: 7,
  palette: 'rainbow',
  custom_colors: null,
}

function stub(method: '$get' | '$patch' | '$delete', response: unknown) {
  vi.mocked(createClient).mockReturnValue({
    v1: { neighborhoods: { ':id': { manage: { $get: vi.fn().mockResolvedValue(response) }, [method]: vi.fn().mockResolvedValue(response) } } },
  } as unknown as ReturnType<typeof createClient>)
}

describe('manage client', () => {
  it('fetchManageConfig returns the config on success', async () => {
    stub('$get', { ok: true, json: async () => config })
    await expect(fetchManageConfig('https://api', 'abc', 'nh_sk_x')).resolves.toEqual(config)
  })

  it('fetchManageConfig throws NeighborhoodNotFound on 404', async () => {
    stub('$get', { ok: false, status: 404, json: async () => ({ error: 'neighborhood_not_found', message: 'Unknown neighborhood' }) })
    await expect(fetchManageConfig('https://api', 'abc', 'nh_sk_x')).rejects.toBeInstanceOf(NeighborhoodNotFound)
  })

  it('fetchManageConfig throws ApiError(403) on a bad secret', async () => {
    stub('$get', { ok: false, status: 403, json: async () => ({ error: 'forbidden', message: 'Invalid admin secret' }) })
    await expect(fetchManageConfig('https://api', 'abc', 'bad')).rejects.toMatchObject({ status: 403 })
  })

  it('patchNeighborhood returns the updated config', async () => {
    stub('$patch', { ok: true, json: async () => ({ ...config, name: 'Renamed' }) })
    await expect(patchNeighborhood('https://api', 'abc', 'nh_sk_x', { name: 'Renamed' })).resolves.toMatchObject({ name: 'Renamed' })
  })

  it('deleteNeighborhood resolves on 204', async () => {
    stub('$delete', { ok: true })
    await expect(deleteNeighborhood('https://api', 'abc', 'nh_sk_x')).resolves.toBeUndefined()
  })

  it('classifyManageError maps errors to states', () => {
    expect(classifyManageError(new NeighborhoodNotFound())).toBe('not-found')
    expect(classifyManageError(new ApiError(403, 'forbidden', 'x'))).toBe('invalid-link')
    expect(classifyManageError(new ApiError(401, 'unauthorized', 'x'))).toBe('invalid-link')
    expect(classifyManageError(new Error('network'))).toBe('error')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @neighborhue/web exec vitest run src/lib/manage.test.ts`
Expected: FAIL — cannot find module `./manage`.

- [ ] **Step 3: Implement `lib/manage.ts`**

`apps/web/src/lib/manage.ts`:

```ts
import type { ManageConfig } from '@neighborhue/api/types'
import { createClient } from './client'
import { ApiError, NeighborhoodNotFound, parseApiErrorBody } from './errors'

// Matches ManageConfig.custom_colors's element (name is optional, per the API).
export interface CustomColor {
  hex: string
  name?: string
}

export interface ManagePatch {
  name?: string | null
  timezone?: string
  rotation_hour?: number
  palette?: string | null
  custom_colors?: CustomColor[] | null
}

function bearer(secret: string) {
  return { headers: { Authorization: `Bearer ${secret}` } }
}

async function toError(res: { status: number; json: () => Promise<unknown> }): Promise<never> {
  const body = parseApiErrorBody(await res.json().catch(() => null))
  if (res.status === 404) throw new NeighborhoodNotFound(body?.message)
  throw new ApiError(res.status, body?.error ?? 'error', body?.message ?? `Request failed: ${res.status}`)
}

export async function fetchManageConfig(baseUrl: string, id: string, secret: string): Promise<ManageConfig> {
  const res = await createClient(baseUrl).v1.neighborhoods[':id'].manage.$get({ param: { id } }, bearer(secret))
  if (res.ok) return (await res.json()) as ManageConfig
  return toError(res)
}

export async function patchNeighborhood(baseUrl: string, id: string, secret: string, patch: ManagePatch): Promise<ManageConfig> {
  const res = await createClient(baseUrl).v1.neighborhoods[':id'].$patch({ param: { id }, json: patch }, bearer(secret))
  if (res.ok) return (await res.json()) as ManageConfig
  return toError(res)
}

export async function deleteNeighborhood(baseUrl: string, id: string, secret: string): Promise<void> {
  const res = await createClient(baseUrl).v1.neighborhoods[':id'].$delete({ param: { id } }, bearer(secret))
  if (!res.ok) await toError(res)
}

// Which error state the Manage page shows. 404 -> the neighborhood is gone;
// 401/403 -> the secret is missing/wrong (invalid link); anything else -> generic.
export function classifyManageError(err: unknown): 'invalid-link' | 'not-found' | 'error' {
  if (err instanceof NeighborhoodNotFound) return 'not-found'
  if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return 'invalid-link'
  return 'error'
}
```

- [ ] **Step 4: Add `manageConfigQueryOptions` to `queries.ts`**

In `apps/web/src/lib/queries.ts`, add the import and the factory:

```ts
import { fetchManageConfig } from './manage'
```

```ts
// The secret authorizes the fetch but is NOT part of the cache key (spec M3):
// it never belongs in query state. One secret per id in practice.
export function manageConfigQueryOptions(id: string, secret: string) {
  return queryOptions({
    queryKey: ['manage', id],
    queryFn: () => fetchManageConfig(API_URL, id, secret),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  })
}
```

- [ ] **Step 5: Run the test + typecheck**

Run: `pnpm -F @neighborhue/web exec vitest run src/lib/manage.test.ts && pnpm -F @neighborhue/web typecheck`
Expected: PASS, typecheck clean (the `$get`/`$patch`/`$delete` Bearer calls type against the hc contract).

- [ ] **Step 6: Lint + commit**

```bash
pnpm check
git add apps/web/src/lib/manage.ts apps/web/src/lib/manage.test.ts apps/web/src/lib/queries.ts
git commit -m "feat(web): Bearer manage client + manageConfigQueryOptions"
```

---

## Task 4: Web — `TimezoneField` gains `hideValidHint`

**Files:**
- Modify: `apps/web/src/components/TimezoneField.tsx`
- Test: `apps/web/src/components/TimezoneField.test.tsx`

**Interfaces:**
- Produces: `TimezoneField` gains optional `hideValidHint?: boolean` (default `false`). When `true` and the value is valid, no hint is rendered and `aria-describedby` is omitted. When invalid, the error shows regardless. 2b's `/create` usage (no prop) is unchanged. Consumed by Task 8.

- [ ] **Step 1: Add the failing test**

Append to `apps/web/src/components/TimezoneField.test.tsx`:

```ts
it('hides the valid-state hint when hideValidHint is set', () => {
  render(<TimezoneField value="America/New_York" detectedZone="America/New_York" onChange={() => {}} hideValidHint />)
  expect(screen.queryByText('Detected from your device.')).not.toBeInTheDocument()
  expect(screen.queryByText('Looks good.')).not.toBeInTheDocument()
})

it('still shows the invalid hint when hideValidHint is set', () => {
  render(<TimezoneField value="Mars/Base" detectedZone="America/New_York" onChange={() => {}} hideValidHint />)
  expect(screen.getByText('Use an IANA zone like America/New_York.')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/TimezoneField.test.tsx`
Expected: FAIL — the valid hint still renders (prop not yet supported).

- [ ] **Step 3: Implement**

Replace `apps/web/src/components/TimezoneField.tsx` with:

```tsx
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons'
import { useId } from 'react'
import { validateTimezone } from '../lib/timezone'
import styles from './TimezoneField.module.css'

interface TimezoneFieldProps {
  value: string
  onChange: (value: string) => void
  detectedZone: string
  // Manage (spec M10) shows only the invalid message — no "Detected"/"Looks good".
  hideValidHint?: boolean
}

export function TimezoneField({ value, onChange, detectedZone, hideValidHint = false }: TimezoneFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const valid = validateTimezone(value)
  const hint = !valid
    ? 'Use an IANA zone like America/New_York.'
    : hideValidHint
      ? null
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
        aria-invalid={!valid}
        aria-describedby={hint ? hintId : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && (
        <p id={hintId} aria-live="polite" className={valid ? styles.hintOk : styles.hintBad}>
          {valid ? <CheckIcon aria-hidden /> : <Cross2Icon aria-hidden />}
          <span>{hint}</span>
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/TimezoneField.test.tsx`
Expected: PASS (the four 2b tests + two new).

- [ ] **Step 5: Typecheck + lint + commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check
git add apps/web/src/components/TimezoneField.tsx apps/web/src/components/TimezoneField.test.tsx
git commit -m "feat(web): TimezoneField hideValidHint for Manage"
```

---

## Task 5: Web — `CustomColorsEditor`

**Files:**
- Create: `apps/web/src/components/CustomColorsEditor.tsx`, `apps/web/src/components/CustomColorsEditor.module.css`
- Test: `apps/web/src/components/CustomColorsEditor.test.tsx`

**Interfaces:**
- Consumes: `validateHex` (Task 2), Radix icons.
- Produces: `CustomColorsEditor({ colors, onChange })` where `colors: Array<{ hex: string; name?: string }>`, `onChange: (next: Array<{ hex: string; name?: string }>) => void`. Emits the new array on every add/remove/reorder (the parent persists it). Consumed by Task 8.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/CustomColorsEditor.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CustomColorsEditor } from './CustomColorsEditor'

const two = [
  { hex: '#FF3B30', name: 'Poppy' },
  { hex: '#2E6BFF', name: 'Cobalt' },
]

describe('CustomColorsEditor', () => {
  it('shows the empty state when there are no colors', () => {
    render(<CustomColorsEditor colors={[]} onChange={() => {}} />)
    expect(screen.getByText('No custom colors yet')).toBeInTheDocument()
  })

  it('adds a valid color (name defaults to Custom when blank)', async () => {
    const onChange = vi.fn()
    render(<CustomColorsEditor colors={[]} onChange={onChange} />)
    await userEvent.type(screen.getByPlaceholderText('#FF6A00'), '#00FF00')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onChange).toHaveBeenCalledWith([{ hex: '#00FF00', name: 'Custom' }])
  })

  it('rejects an invalid hex and does not add', async () => {
    const onChange = vi.fn()
    render(<CustomColorsEditor colors={[]} onChange={onChange} />)
    await userEvent.type(screen.getByPlaceholderText('#FF6A00'), '#F60')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('Enter a valid hex like #FF6A00.')).toBeInTheDocument()
  })

  it('removes a color', async () => {
    const onChange = vi.fn()
    render(<CustomColorsEditor colors={two} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Remove Poppy' }))
    expect(onChange).toHaveBeenCalledWith([{ hex: '#2E6BFF', name: 'Cobalt' }])
  })

  it('reorders down, and top-up / bottom-down are no-ops', async () => {
    const onChange = vi.fn()
    render(<CustomColorsEditor colors={two} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Move Poppy down' }))
    expect(onChange).toHaveBeenCalledWith([
      { hex: '#2E6BFF', name: 'Cobalt' },
      { hex: '#FF3B30', name: 'Poppy' },
    ])
    onChange.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Move Poppy up' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/CustomColorsEditor.test.tsx`
Expected: FAIL — cannot find module `./CustomColorsEditor`.

- [ ] **Step 3: Implement the component + CSS**

`apps/web/src/components/CustomColorsEditor.tsx`:

```tsx
import { BlendingModeIcon, ChevronDownIcon, ChevronUpIcon, Cross2Icon, PlusIcon } from '@radix-ui/react-icons'
import { useState } from 'react'
import { validateHex } from '../lib/hex'
import type { CustomColor } from '../lib/manage'
import styles from './CustomColorsEditor.module.css'

interface CustomColorsEditorProps {
  colors: CustomColor[]
  onChange: (next: CustomColor[]) => void
}

export function CustomColorsEditor({ colors, onChange }: CustomColorsEditorProps) {
  const [newHex, setNewHex] = useState('')
  const [newName, setNewName] = useState('')
  const hexInvalid = newHex.trim() !== '' && !validateHex(newHex.trim())

  function add() {
    const hex = newHex.trim()
    if (!validateHex(hex)) return
    onChange([...colors, { hex, name: newName.trim() || 'Custom' }])
    setNewHex('')
    setNewName('')
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= colors.length) return
    const next = [...colors]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  function remove(i: number) {
    onChange(colors.filter((_, k) => k !== i))
  }

  return (
    <div className={styles.editor}>
      <p className={styles.heading}>Custom colors</p>

      {colors.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden>
            <BlendingModeIcon />
          </span>
          <p className={styles.emptyTitle}>No custom colors yet</p>
          <p className={styles.emptyBody}>Add your first color below — it'll join the daily rotation.</p>
        </div>
      ) : (
        <ul className={styles.rows}>
          {colors.map((c, i) => {
            const label = c.name ?? c.hex
            return (
              <li key={`${c.hex}-${i}`} className={styles.row}>
                <span className={styles.swatch} style={{ background: c.hex }} aria-hidden />
                <span className={styles.text}>
                  <span className={styles.name}>{c.name ?? 'Custom'}</span>
                  <span className={styles.hex}>{c.hex}</span>
                </span>
                <span className={styles.controls}>
                  <button type="button" className={styles.iconBtn} aria-label={`Move ${label} up`} onClick={() => move(i, -1)}>
                    <ChevronUpIcon aria-hidden />
                  </button>
                  <button type="button" className={styles.iconBtn} aria-label={`Move ${label} down`} onClick={() => move(i, 1)}>
                    <ChevronDownIcon aria-hidden />
                  </button>
                  <button type="button" className={styles.removeBtn} aria-label={`Remove ${label}`} onClick={() => remove(i)}>
                    <Cross2Icon aria-hidden />
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <div className={styles.addRow}>
        <input
          className={styles.hexInput}
          value={newHex}
          placeholder="#FF6A00"
          aria-label="New color hex"
          aria-invalid={hexInvalid}
          spellCheck={false}
          autoCapitalize="off"
          onChange={(e) => setNewHex(e.target.value)}
        />
        <input
          className={styles.nameInput}
          value={newName}
          placeholder="Color name"
          aria-label="New color name"
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="button" className={styles.addBtn} onClick={add}>
          <PlusIcon aria-hidden /> Add
        </button>
      </div>
      {hexInvalid && <p className={styles.error}>Enter a valid hex like #FF6A00.</p>}
    </div>
  )
}
```

`apps/web/src/components/CustomColorsEditor.module.css`:

```css
.editor {
  margin-top: 16px;
  padding-top: 18px;
  border-top: 1px solid var(--hairline);
}

.heading {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
  padding: 26px 20px;
  border: 1.5px dashed var(--hairline);
  border-radius: 13px;
}

.emptyIcon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--text-faint);
}

.emptyTitle {
  font-size: 13.5px;
  font-weight: 600;
}

.emptyBody {
  font-size: 12.5px;
  color: var(--text-faint);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  padding: 0;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: 11px;
  padding: 9px 12px;
}

.swatch {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  box-shadow: inset 0 0 0 1px var(--hairline);
  flex-shrink: 0;
}

.text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.name {
  font-size: 13.5px;
  font-weight: 600;
}

.hex {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--text-faint);
}

.controls {
  display: flex;
  gap: 4px;
}

.iconBtn,
.removeBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  border: 1px solid var(--hairline);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}

.removeBtn {
  border-color: var(--danger);
  color: var(--danger);
}

.addRow {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.hexInput {
  width: 118px;
  height: 44px;
  border-radius: 10px;
  border: 1px solid var(--hairline);
  background: var(--surface);
  padding: 0 12px;
  font-family: var(--font-mono);
  font-size: 13px;
}

.nameInput {
  flex: 1;
  min-width: 140px;
  height: 44px;
  border-radius: 10px;
  border: 1px solid var(--hairline);
  background: var(--surface);
  padding: 0 12px;
  font-size: 13.5px;
}

.addBtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 44px;
  padding: 0 16px;
  border: 0;
  border-radius: 10px;
  background: var(--cta-bg);
  color: var(--cta-fg);
  font-weight: 600;
  cursor: pointer;
}

.error {
  margin-top: 7px;
  font-size: 12px;
  color: var(--danger);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/CustomColorsEditor.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck + lint + commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check
git add apps/web/src/components/CustomColorsEditor.tsx apps/web/src/components/CustomColorsEditor.module.css apps/web/src/components/CustomColorsEditor.test.tsx
git commit -m "feat(web): CustomColorsEditor"
```

---

## Task 6: Web — `SaveIndicator`

**Files:**
- Create: `apps/web/src/components/SaveIndicator.tsx`, `apps/web/src/components/SaveIndicator.module.css`
- Test: `apps/web/src/components/SaveIndicator.test.tsx`

**Interfaces:**
- Produces: `SaveIndicator({ status, onRetry })` where `status: 'idle' | 'saving' | 'saved' | 'error'`, `onRetry?: () => void`. `aria-live="polite"`. Renders nothing at `idle`; "Saving…" / "Saved" / "Couldn't save — Retry" otherwise. Consumed by Task 8.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/SaveIndicator.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SaveIndicator } from './SaveIndicator'

describe('SaveIndicator', () => {
  it('renders nothing when idle', () => {
    const { container } = render(<SaveIndicator status="idle" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows Saving and Saved', () => {
    const { rerender } = render(<SaveIndicator status="saving" />)
    expect(screen.getByText('Saving…')).toBeInTheDocument()
    rerender(<SaveIndicator status="saved" />)
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('offers retry on error', async () => {
    const onRetry = vi.fn()
    render(<SaveIndicator status="error" onRetry={onRetry} />)
    expect(screen.getByText(/Couldn.t save/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/SaveIndicator.test.tsx`
Expected: FAIL — cannot find module `./SaveIndicator`.

- [ ] **Step 3: Implement the component + CSS**

`apps/web/src/components/SaveIndicator.tsx`:

```tsx
import { CheckIcon } from '@radix-ui/react-icons'
import styles from './SaveIndicator.module.css'

interface SaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error'
  onRetry?: () => void
}

export function SaveIndicator({ status, onRetry }: SaveIndicatorProps) {
  return (
    <span className={styles.wrap} aria-live="polite">
      {status === 'saving' && <span className={styles.muted}>Saving…</span>}
      {status === 'saved' && (
        <span className={styles.saved}>
          <CheckIcon aria-hidden /> Saved
        </span>
      )}
      {status === 'error' && (
        <span className={styles.error}>
          Couldn't save —{' '}
          <button type="button" className={styles.retry} onClick={onRetry}>
            Retry
          </button>
        </span>
      )}
    </span>
  )
}
```

`apps/web/src/components/SaveIndicator.module.css`:

```css
.wrap {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  font-size: 13px;
}

.muted {
  color: var(--text-faint);
}

.saved {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--success);
}

.error {
  color: var(--danger);
}

.retry {
  background: none;
  border: 0;
  padding: 0;
  color: var(--danger);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/SaveIndicator.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint + commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check
git add apps/web/src/components/SaveIndicator.tsx apps/web/src/components/SaveIndicator.module.css apps/web/src/components/SaveIndicator.test.tsx
git commit -m "feat(web): SaveIndicator"
```

---

## Task 7: Web — `DeleteDialog` (+ Radix Dialog dependency)

**Files:**
- Create: `apps/web/src/components/DeleteDialog.tsx`, `apps/web/src/components/DeleteDialog.module.css`
- Test: `apps/web/src/components/DeleteDialog.test.tsx`
- Modify: `apps/web/package.json` (add `@radix-ui/react-dialog`)

**Interfaces:**
- Produces: `DeleteDialog({ name, status, onConfirm })` where `name: string | null`, `status: 'idle' | 'deleting' | 'error'`, `onConfirm: () => void`. Renders the danger "Delete" trigger + the confirm modal; the confirm button calls `onConfirm` (label "Deleting…" while `deleting`); a delete error shows in the dialog. Consumed by Task 8.

- [ ] **Step 1: Install Radix Dialog**

Run: `pnpm -F @neighborhue/web add @radix-ui/react-dialog`
Expected: adds `@radix-ui/react-dialog` to `apps/web/package.json` dependencies.

- [ ] **Step 2: Write the failing test**

`apps/web/src/components/DeleteDialog.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DeleteDialog } from './DeleteDialog'

describe('DeleteDialog', () => {
  it('opens on the trigger and confirms', async () => {
    const onConfirm = vi.fn()
    render(<DeleteDialog name="Maple Street" status="idle" onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete Maple Street?')).toBeInTheDocument()
    // The dialog's confirm button (there are two "Delete" — pick the one in the dialog)
    const confirm = screen.getByRole('button', { name: 'Delete neighborhood permanently' })
    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalled()
  })

  it('cancel closes without confirming', async () => {
    const onConfirm = vi.fn()
    render(<DeleteDialog name="Maple Street" status="idle" onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.queryByText('Delete Maple Street?')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/DeleteDialog.test.tsx`
Expected: FAIL — cannot find module `./DeleteDialog`.

- [ ] **Step 4: Implement the component + CSS**

`apps/web/src/components/DeleteDialog.tsx`:

```tsx
import * as Dialog from '@radix-ui/react-dialog'
import { ExclamationTriangleIcon, TrashIcon } from '@radix-ui/react-icons'
import styles from './DeleteDialog.module.css'

interface DeleteDialogProps {
  name: string | null
  status: 'idle' | 'deleting' | 'error'
  onConfirm: () => void
}

export function DeleteDialog({ name, status, onConfirm }: DeleteDialogProps) {
  const label = name ?? 'this neighborhood'
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className={styles.trigger}>
          <TrashIcon aria-hidden /> Delete
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <span className={styles.icon} aria-hidden>
            <ExclamationTriangleIcon width={24} height={24} />
          </span>
          <Dialog.Title className={styles.title}>Delete {label}?</Dialog.Title>
          <Dialog.Description className={styles.body}>
            This permanently removes the neighborhood. Neighbors' lights will stop updating and the link will 404. This
            can't be undone.
          </Dialog.Description>
          {status === 'error' && <p className={styles.error}>Couldn't delete — try again.</p>}
          <div className={styles.actions}>
            <Dialog.Close asChild>
              <button type="button" className={styles.cancel}>
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              className={styles.confirm}
              aria-label="Delete neighborhood permanently"
              disabled={status === 'deleting'}
              onClick={onConfirm}
            >
              <TrashIcon aria-hidden /> {status === 'deleting' ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

`apps/web/src/components/DeleteDialog.module.css`:

```css
.trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 11px;
  border: 1px solid var(--danger);
  background: var(--surface);
  color: var(--danger);
  font-weight: 600;
  cursor: pointer;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(20, 18, 16, 0.5);
  backdrop-filter: blur(3px);
}

.content {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(440px, calc(100vw - 32px));
  background: var(--surface);
  border-radius: 20px;
  padding: 28px;
  box-shadow: var(--shadow-modal);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--danger-tint);
  color: var(--danger);
}

.title {
  font-size: 20px;
  font-weight: 600;
}

.body {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-muted);
}

.error {
  font-size: 13px;
  color: var(--danger);
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: 6px;
}

.cancel {
  flex: 1;
  min-height: 44px;
  border-radius: 11px;
  border: 1px solid var(--hairline);
  background: var(--surface);
  color: var(--text);
  font-weight: 600;
  cursor: pointer;
}

.confirm {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  border-radius: 11px;
  border: 0;
  background: var(--danger);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/DeleteDialog.test.tsx`
Expected: PASS (Radix renders the content in a portal under `document.body`; Testing Library queries find it).

- [ ] **Step 6: Typecheck + lint + commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check
git add apps/web/src/components/DeleteDialog.tsx apps/web/src/components/DeleteDialog.module.css apps/web/src/components/DeleteDialog.test.tsx apps/web/package.json ../../pnpm-lock.yaml
git commit -m "feat(web): DeleteDialog (Radix Dialog)"
```

---

## Task 8: Web — `ManageView` orchestrator

**Files:**
- Create: `apps/web/src/components/ManageView.tsx`, `apps/web/src/components/ManageView.module.css`
- Test: `apps/web/src/components/ManageView.test.tsx`

**Interfaces:**
- Consumes: `ManageConfig`, `PublicNeighborhood` (`@neighborhue/api/types`), `ManagePatch` (`../lib/manage`), `PaletteSummary`/`PaletteColor` + `resolvePalette` (`../lib/palette`), `formatHourLabel` (`../lib/hour`), and `PalettePicker`, `RotationHourStepper`, `TimezoneField`, `ShareCard`, `CopyButton`, `HaPanel`, `CustomColorsEditor`, `SaveIndicator`, `DeleteDialog`, `Link`.
- Produces: presentational `ManageView` (props below). Owns form state seeded from `config`, the custom mode, auto-save commits (calling `onSave`), and the delete flow. The container (Task 9) supplies data + callbacks.

```ts
interface ManageViewProps {
  id: string
  config: ManageConfig
  neighborhood: PublicNeighborhood // public read — supplies the real preview color + rotation
  palettes: PaletteSummary[]
  onSave: (patch: ManagePatch) => void
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  onRetrySave: () => void
  onDelete: () => void
  deleteStatus: 'idle' | 'deleting' | 'error'
}
```

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/ManageView.test.tsx`:

```tsx
import type { ManageConfig, PublicNeighborhood } from '@neighborhue/api/types'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { PaletteSummary } from '../lib/palette'
import { ManageView } from './ManageView'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: ComponentProps<'a'> & { to?: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

const palettes: PaletteSummary[] = [
  { slug: 'rainbow', name: 'Rainbow Colors', description: 'The classic seven.', is_default: true, colors: [{ hex: '#FF0000', name: 'Red' }] },
  { slug: 'cool', name: 'Cool', description: 'Blues and teals.', is_default: false, colors: [{ hex: '#2E6BFF', name: 'Cornflower' }] },
]
const neighborhood = {
  id: 'abc',
  name: 'Maple Street',
  timezone: 'America/New_York',
  rotation_hour: 7,
  color: { hex: '#FF0000', rgb: [255, 0, 0], hsl: [0, 100, 50], name: 'Red' },
  rotated_at: '2026-07-21T07:00:00Z',
  next_rotation_at: '2026-07-22T07:00:00Z',
  seconds_until_rotation: 3600,
  palette: 'rainbow',
  day_index: 1,
} satisfies PublicNeighborhood

function setup(configOverride: Partial<ManageConfig> = {}, props: Partial<ComponentProps<typeof ManageView>> = {}) {
  const config: ManageConfig = { id: 'abc', name: 'Maple Street', timezone: 'America/New_York', rotation_hour: 7, palette: 'rainbow', custom_colors: null, ...configOverride }
  const onSave = vi.fn()
  const onDelete = vi.fn()
  render(
    <ManageView
      id="abc"
      config={config}
      neighborhood={neighborhood}
      palettes={palettes}
      onSave={onSave}
      saveStatus="idle"
      onRetrySave={() => {}}
      onDelete={onDelete}
      deleteStatus="idle"
      {...props}
    />,
  )
  return { onSave, onDelete }
}

describe('ManageView', () => {
  it('seeds the name and saves it on blur', async () => {
    const { onSave } = setup()
    const name = screen.getByLabelText('Neighborhood name')
    expect(name).toHaveValue('Maple Street')
    await userEvent.clear(name)
    await userEvent.type(name, 'Oak Ave')
    await userEvent.tab() // blur
    expect(onSave).toHaveBeenCalledWith({ name: 'Oak Ave' })
  })

  it('saves a curated palette pick with custom_colors cleared', async () => {
    const { onSave } = setup()
    await userEvent.click(screen.getByRole('button', { name: /Cool/ }))
    expect(onSave).toHaveBeenCalledWith({ palette: 'cool', custom_colors: null })
  })

  it('opens Custom mode and saves the first added color with palette cleared', async () => {
    const { onSave } = setup()
    await userEvent.click(screen.getByRole('button', { name: /Custom colors/ }))
    await userEvent.type(screen.getByPlaceholderText('#FF6A00'), '#00FF00')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onSave).toHaveBeenCalledWith({ palette: null, custom_colors: [{ hex: '#00FF00', name: 'Custom' }] })
  })

  it('starts in Custom mode when config has custom_colors', () => {
    setup({ palette: null, custom_colors: [{ hex: '#FF3B30', name: 'Poppy' }] })
    expect(screen.getByText('Poppy')).toBeInTheDocument()
  })

  it('removing the last custom color saves custom_colors: null', async () => {
    const { onSave } = setup({ palette: null, custom_colors: [{ hex: '#FF3B30', name: 'Poppy' }] })
    await userEvent.click(screen.getByRole('button', { name: 'Remove Poppy' }))
    expect(onSave).toHaveBeenCalledWith({ custom_colors: null })
  })

  it('confirms delete', async () => {
    const { onDelete } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete neighborhood permanently' }))
    expect(onDelete).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/ManageView.test.tsx`
Expected: FAIL — cannot find module `./ManageView`.

- [ ] **Step 3: Implement the component + CSS**

`apps/web/src/components/ManageView.tsx`:

```tsx
import type { ManageConfig, PublicNeighborhood } from '@neighborhue/api/types'
import { EyeOpenIcon, LockClosedIcon } from '@radix-ui/react-icons'
import { Link } from '@tanstack/react-router'
import { useId, useState } from 'react'
import { formatHourLabel } from '../lib/hour'
import type { CustomColor, ManagePatch } from '../lib/manage'
import { type PaletteColor, type PaletteSummary, resolvePalette } from '../lib/palette'
import { validateTimezone } from '../lib/timezone'
import { CopyButton } from './CopyButton'
import { CustomColorsEditor } from './CustomColorsEditor'
import { DeleteDialog } from './DeleteDialog'
import { HaPanel } from './HaPanel'
import styles from './ManageView.module.css'
import { PalettePicker } from './PalettePicker'
import { RotationHourStepper } from './RotationHourStepper'
import { SaveIndicator } from './SaveIndicator'
import { ShareCard } from './ShareCard'
import { TimezoneField } from './TimezoneField'

interface ManageViewProps {
  id: string
  config: ManageConfig
  neighborhood: PublicNeighborhood
  palettes: PaletteSummary[]
  onSave: (patch: ManagePatch) => void
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  onRetrySave: () => void
  onDelete: () => void
  deleteStatus: 'idle' | 'deleting' | 'error'
}

export function ManageView({ id, config, neighborhood, palettes, onSave, saveStatus, onRetrySave, onDelete, deleteStatus }: ManageViewProps) {
  const nameId = useId()
  const defaultSlug = palettes.find((p) => p.is_default)?.slug ?? palettes[0]?.slug ?? null
  const startCustom = (config.custom_colors?.length ?? 0) > 0

  const [name, setName] = useState(config.name ?? '')
  const [timezone, setTimezone] = useState(config.timezone)
  const [hour, setHour] = useState(config.rotation_hour)
  // palette=null with no custom colors means the neighborhood rides the default
  // palette (spec M2 / Create C3) — seed the default slug, not "Custom".
  const [paletteSlug, setPaletteSlug] = useState<string | null>(startCustom ? null : (config.palette ?? defaultSlug))
  const [custom, setCustom] = useState<CustomColor[]>(config.custom_colors ?? [])
  const [customMode, setCustomMode] = useState(startCustom)

  const shareUrl = `https://neighborhue.app/n/${id}`

  // Discrete commits (spec M1/M2).
  function pickPalette(slug: string | null) {
    if (slug === null) {
      setCustomMode(true) // transient — no PATCH until the first custom color (M2)
      return
    }
    setCustomMode(false)
    setPaletteSlug(slug)
    setCustom([])
    onSave({ palette: slug, custom_colors: null })
  }

  function commitCustom(next: CustomColor[]) {
    setCustom(next)
    if (next.length === 0) {
      onSave({ custom_colors: null })
    } else {
      setPaletteSlug(null)
      onSave({ palette: null, custom_colors: next })
    }
  }

  function commitHour(next: number) {
    setHour(next)
    onSave({ rotation_hour: next })
  }

  // Preview: swatches reflect the local edit; the big color is the server's real
  // today-color (props), which the container refetches after a palette/custom save (M6).
  const resolved = resolvePalette(paletteSlug, palettes)
  const previewColors: PaletteColor[] = customMode
    ? custom.map((c) => ({ hex: c.hex, name: c.name ?? null }))
    : resolved.kind === 'curated'
      ? resolved.colors
      : []
  const previewPaletteName = customMode || resolved.kind !== 'curated' ? 'Custom colors' : resolved.name
  const selectedSlug = customMode ? null : paletteSlug

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" aria-label="Neighborhue home" className={styles.logo} />
        <Link to="/n/$id" params={{ id }} className={styles.viewPublic}>
          <EyeOpenIcon aria-hidden /> View public page
        </Link>
      </header>

      <main className={styles.main}>
        <div className={styles.titleRow}>
          <h1 className={styles.h1}>Manage</h1>
          <span className={styles.secretChip}>
            <LockClosedIcon aria-hidden /> Secret link
          </span>
          <SaveIndicator status={saveStatus} onRetry={onRetrySave} />
        </div>
        <p className={styles.subtitle}>
          You're editing <b>{name.trim() || 'Untitled'}</b> via its private link. Changes are live for everyone immediately.
        </p>

        <div className={styles.columns}>
          <div className={styles.left}>
            <section className={styles.card}>
              <h2 className={styles.cardHeading}>Details</h2>
              <div className={styles.field}>
                <label htmlFor={nameId} className={styles.label}>
                  Neighborhood name
                </label>
                <input
                  id={nameId}
                  className={styles.input}
                  value={name}
                  maxLength={120}
                  placeholder="Untitled"
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => name.trim() !== (config.name ?? '') && onSave({ name: name.trim() || null })}
                />
              </div>
              {/* The wrapper's onBlur fires when focus leaves the tz input; save a valid, changed zone. */}
              <div onBlur={() => timezone !== config.timezone && validateTimezone(timezone) && onSave({ timezone })}>
                <TimezoneField value={timezone} detectedZone={timezone} hideValidHint onChange={setTimezone} />
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Rotation hour</span>
                <RotationHourStepper hour={hour} onChange={commitHour} />
              </div>
            </section>

            <section className={styles.card}>
              <h2 className={styles.cardHeading}>Palette</h2>
              <PalettePicker palettes={palettes} selectedSlug={selectedSlug} onSelect={pickPalette} />
              {customMode && <CustomColorsEditor colors={custom} onChange={commitCustom} />}
            </section>

            <section className={styles.card}>
              <h2 className={styles.cardHeading}>Share &amp; connect</h2>
              <p className={styles.label}>Public share link</p>
              <div className={styles.linkRow}>
                <span className={styles.url}>{shareUrl}</span>
                <CopyButton value={shareUrl} label="Copy share link" />
              </div>
              <HaPanel neighborhoodId={id} />
            </section>

            <section className={styles.dangerCard}>
              <div>
                <h2 className={styles.dangerHeading}>Delete neighborhood</h2>
                <p className={styles.dangerBody}>Permanently removes it. Neighbors' lights stop updating.</p>
              </div>
              <DeleteDialog name={config.name} status={deleteStatus} onConfirm={onDelete} />
            </section>
          </div>

          <div className={styles.right}>
            <p className={styles.previewEyebrow}>Live preview · today</p>
            <ShareCard
              name={name}
              activeColor={neighborhood.color}
              colors={previewColors}
              paletteName={previewPaletteName}
              rotationLabel={formatHourLabel(hour)}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
```

`apps/web/src/components/ManageView.module.css`:

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

.viewPublic {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 11px;
  border: 1px solid var(--hairline);
  background: var(--surface);
  color: var(--text);
  font-weight: 600;
  font-size: 14px;
  text-decoration: none;
}

.main {
  max-width: 1120px;
  margin: 0 auto;
  padding: 8px 30px 120px;
}

.titleRow {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.h1 {
  font-size: 36px;
  font-weight: 600;
  letter-spacing: -0.03em;
}

.secretChip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 7px;
  border: 1px solid var(--warning);
  background: var(--warning-tint);
  color: var(--warning);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 600;
}

.subtitle {
  margin-top: 10px;
  font-size: 15px;
  color: var(--text-muted);
}

.columns {
  display: flex;
  flex-wrap: wrap;
  gap: 32px;
  align-items: flex-start;
  margin-top: 28px;
}

.left {
  flex: 1 1 460px;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.right {
  flex: 1 1 360px;
  min-width: 300px;
  position: sticky;
  top: 24px;
}

.card {
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: 18px;
  padding: 26px;
  box-shadow: var(--shadow-card);
}

.cardHeading {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 18px;
}

.label {
  font-size: 14px;
  font-weight: 600;
}

.input {
  width: 100%;
  height: 44px;
  border-radius: 11px;
  border: 1px solid var(--hairline);
  background: var(--surface);
  padding: 0 14px;
  font-size: 14px;
}

.linkRow {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 0 12px;
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

.dangerCard {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  background: var(--surface);
  border: 1px solid var(--danger);
  border-radius: 18px;
  padding: 22px 26px;
}

.dangerHeading {
  font-size: 14px;
  font-weight: 600;
  color: var(--danger);
}

.dangerBody {
  font-size: 12.5px;
  color: var(--text-faint);
}

.previewEyebrow {
  font-family: var(--font-mono);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-faint);
  margin-bottom: 12px;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -F @neighborhue/web exec vitest run src/components/ManageView.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck + lint + commit**

```bash
pnpm -F @neighborhue/web typecheck && pnpm check
git add apps/web/src/components/ManageView.tsx apps/web/src/components/ManageView.module.css apps/web/src/components/ManageView.test.tsx
git commit -m "feat(web): ManageView orchestrator"
```

---

## Task 9: Web — `/manage/$id` container route

**Files:**
- Modify: `apps/web/src/routes/manage.$id.tsx`

**Interfaces:**
- Consumes: `manageConfigQueryOptions` (`../lib/queries`), `neighborhoodQueryOptions`/`palettesQueryOptions` (`../lib/queries`), `patchNeighborhood`/`deleteNeighborhood`/`classifyManageError`/`ManagePatch` (`../lib/manage`), `API_URL` (`../lib/config`), `ManageView` (Task 8). Reuses the states CSS `routes/n.$id.states.module.css`.
- Produces: the real `/manage/$id` route (`ssr:false`). Verified by typecheck + build + suite; no route unit test (matches `n.$id`/`create`).

- [ ] **Step 1: Replace the stub with the real container**

`apps/web/src/routes/manage.$id.tsx`:

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ManageView } from '../components/ManageView'
import { API_URL } from '../lib/config'
import { classifyManageError, deleteNeighborhood, type ManagePatch, patchNeighborhood } from '../lib/manage'
import { manageConfigQueryOptions, neighborhoodQueryOptions, palettesQueryOptions } from '../lib/queries'
import stateStyles from './n.$id.states.module.css'

// ssr:false — the secret rides in the URL #fragment and must never reach the
// server (spec M3). Everything here runs client-side.
export const Route = createFileRoute('/manage/$id')({
  ssr: false,
  component: ManagePage,
})

function StateMessage({ title, body, cta }: { title: string; body: string; cta?: { to: '/create'; label: string } }) {
  return (
    <main className={stateStyles.state}>
      <h1 className={stateStyles.title}>{title}</h1>
      <p className={stateStyles.body}>{body}</p>
      {cta && (
        <Link to={cta.to} className={stateStyles.cta}>
          {cta.label}
        </Link>
      )}
    </main>
  )
}

function ManagePage() {
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  const [secret] = useState(() => (typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, '')))
  const [deleted, setDeleted] = useState(false)

  const configQuery = useQuery({ ...manageConfigQueryOptions(id, secret), enabled: secret !== '' })
  const publicQuery = useQuery(neighborhoodQueryOptions(id))
  const palettesQuery = useQuery(palettesQueryOptions())

  const save = useMutation({
    mutationFn: (patch: ManagePatch) => patchNeighborhood(API_URL, id, secret, patch),
    onSuccess: (updated, patch) => {
      queryClient.setQueryData(manageConfigQueryOptions(id, secret).queryKey, updated)
      // A palette/custom change alters the server-computed color — refetch the public read (M6).
      if ('palette' in patch || 'custom_colors' in patch) {
        void queryClient.invalidateQueries({ queryKey: neighborhoodQueryOptions(id).queryKey })
      }
    },
  })

  const del = useMutation({
    mutationFn: () => deleteNeighborhood(API_URL, id, secret),
    onSuccess: () => setDeleted(true),
  })

  if (deleted) {
    return <StateMessage title="This neighborhood was deleted" body="It's gone and its link now 404s. You can start a fresh one anytime — no account needed." cta={{ to: '/create', label: 'Create a new one' }} />
  }
  if (secret === '') {
    return <StateMessage title="This management link isn’t valid" body="A management link ends with #your-secret — copy the whole link, including the part after the # ." />
  }
  if (configQuery.isPending || publicQuery.isPending || palettesQuery.isPending) {
    return <main className={stateStyles.state}><p className={stateStyles.body}>Loading…</p></main>
  }
  if (configQuery.error) {
    const kind = classifyManageError(configQuery.error)
    if (kind === 'not-found') return <StateMessage title="This neighborhood doesn’t exist" body="The link may be mistyped, or the neighborhood may have been deleted." cta={{ to: '/create', label: 'Create a neighborhood' }} />
    if (kind === 'invalid-link') return <StateMessage title="This management link isn’t valid" body="The secret in this link is wrong or missing. Use the exact private link you saved when you created the neighborhood." />
    return <StateMessage title="Couldn’t load this neighborhood" body={configQuery.error.message} />
  }
  if (publicQuery.error || palettesQuery.error || !configQuery.data || !publicQuery.data || !palettesQuery.data) {
    return <StateMessage title="Couldn’t load this neighborhood" body="Please try again." />
  }

  const saveStatus = save.isPending ? 'saving' : save.isError ? 'error' : save.isSuccess ? 'saved' : 'idle'
  const deleteStatus = del.isPending ? 'deleting' : del.isError ? 'error' : 'idle'

  return (
    <ManageView
      id={id}
      config={configQuery.data}
      neighborhood={publicQuery.data}
      palettes={palettesQuery.data}
      onSave={(patch) => save.mutate(patch)}
      saveStatus={saveStatus}
      onRetrySave={() => save.variables !== undefined && save.mutate(save.variables)}
      onDelete={() => del.mutate()}
      deleteStatus={deleteStatus}
    />
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F @neighborhue/web typecheck`
Expected: PASS.

- [ ] **Step 3: Build**

Run: `pnpm -F @neighborhue/web build`
Expected: build succeeds.

- [ ] **Step 4: Full web suite + lint**

Run: `pnpm -F @neighborhue/web test && pnpm check`
Expected: all web tests pass, Biome clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/manage.$id.tsx
git commit -m "feat(web): wire the real /manage/:id route"
```

---

## Final verification (after Task 9)

- [ ] Whole monorepo: `pnpm typecheck && pnpm test && pnpm check` — all green.
- [ ] Manual (local `pnpm -F @neighborhue/web dev`, or post-deploy): open `/manage/{id}#{secret}` for a real neighborhood → edit name (blur → Saved) → change palette (preview color refetches) → switch to Custom, add/remove/reorder colors → toggle HA → delete (dialog → deleted state). Confirm no-secret / wrong-secret / unknown-id states. **Deploy BOTH workers** (`ManageConfig` is API-side) and clean up test data.
- [ ] Whole-branch review via subagent-driven-development's final gate.

---

## Notes for the implementer

- **The route (Task 9) has no unit test** — it needs a real Router/Query provider; the flow lives in `ManageView` (Task 8), exactly like `routes/n.$id.tsx` and `routes/create.tsx`.
- **`routeTree.gen.ts` needs no manual edit** — `/manage/$id` already exists in the tree; only the component body changes.
- **Bearer via hc:** the second arg to `$get`/`$patch`/`$delete` is `{ headers: { Authorization: \`Bearer ${secret}\` } }`. The secret never enters a Query key (Task 3).
- **Radix icons used:** `EyeOpenIcon`, `LockClosedIcon`, `BlendingModeIcon`, `ChevronUpIcon`, `ChevronDownIcon`, `Cross2Icon`, `PlusIcon`, `CheckIcon`, `ExclamationTriangleIcon`, `TrashIcon` — all from `@radix-ui/react-icons`. `@radix-ui/react-dialog` is added in Task 7.
- **`ShareCard` is reused with a real fixed color** (`activeColor={neighborhood.color}`, no `onPreviewColor`), so its swatch row is the static `SwatchRow` — exactly the 2c/2d-reuse path it was built for.
