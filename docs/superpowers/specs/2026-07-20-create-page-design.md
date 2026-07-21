# Create Page (Spec 2b) — Design

**Date:** 2026-07-20
**Status:** Approved for planning
**Scope:** Spec 2b of four. Spec 2 was decomposed into **2a Share → 2b Create → 2c Manage → 2d Home** (S1). This spec covers only the Create page at `/create`.
**Builds on:** [`2026-07-20-share-page-design.md`](2026-07-20-share-page-design.md) — shipped and deployed to `neighborhue.app` on 2026-07-20, and the [foundation](2026-07-17-frontend-foundation-design.md) beneath it.
**Design source:** [`docs/handoff/neighborhue/design_handoff_neighborhue/README.md`](../../handoff/neighborhue/design_handoff_neighborhue/README.md) §2 "Create", plus the mockup markup in `Neighborhue App.dc.html` (Create screen). Where the handoff and the live API disagree, **the API wins**.

---

## 1. Why

`/create` is the funnel every neighborhood is born through. Home's CTAs point here; the Share page's 404 points here. It has to turn "I heard about this" into a working neighborhood plus a saved secret link in under a minute, with no account.

The route already exists as an `ssr:false` stub (the timezone default needs the browser). This spec replaces the stub with the real two-column screen: a form on the left, a live palette preview on the right, swapping to a success card once the neighborhood is created.

It also delivers the first **`ShareCard`** — the compact preview card the handoff reuses on Home and Manage. Building it here, against its first real consumer, is the same "shared components emerge from their first consumer" discipline that shaped 2a (S1).

---

## 2. Decisions

| # | Decision | Resolution | Rationale |
|---|---|---|---|
| C1 | Live-preview color | **Cycling sample reel + hover/focus-to-pin, with the active swatch highlighted** | The daily color is deterministic from neighborhood-id + day and computed server-side; before creation there is no id, so no real "today" color exists. The prototype fakes it by picking swatch 0 client-side — exactly the color *selection* the foundation forbids in the client (W-constraint). Cycling through the palette reads honestly as "one of these, chosen each day"; hover/focus lets the user explore each color; the highlight ties the big panel to the swatch it is showing. |
| C2 | Preview countdown | **Drop the ticking countdown; show "Rotates daily at {hour}" only** | A real countdown needs `next_rotation_at`, which exists only after creation, and faking it would mean duplicating the API's `rotation()` math client-side. The authoritative live countdown already lives on the Share page (2a S6). The static line still communicates the rotation setting. |
| C3 | "Custom colors" at create | **Send no palette; defer color entry to Manage with the handoff's verbatim note** | `POST /v1/neighborhoods` accepts no `custom_colors` (it always stores `null`). Selecting Custom therefore omits `palette` → the API rides its default palette until the owner adds colors in Manage. Note: *"Create the neighborhood first — you'll add and reorder your custom colors in Manage."* |
| C4 | Loading + error states | **Add both (the prototype has neither)** | The mockup flips to success instantly with no network. We're production: `useMutation` gives a pending state (submit disabled, "Creating…") and an error path (inline message, form preserved for retry). |
| C5 | Success-state persistence | **In-memory only; the secret is shown once, never persisted or re-sent** | The management link is a bearer credential (foundation constraint). Storing it in `sessionStorage` is gratuitous risk; the fragment-based secret must not reach a server log. A refresh losing the success card is correct "shown once" behavior — the warning tells the user to save it. |
| C6 | Result links | **Public `/n/{id}`, manage from the API's `manage_url`; no slugs** | The API issues UUID ids and returns `manage_url = {base}/manage/{id}#{secret}`. The handoff's `/n/maple-grove` slugs are placeholders; slugs remain deferred (2a §9). |
| C7 | Timezone validation | **Validate against `Intl.supportedValuesOf('timeZone')`; invalid blocks submit** | The API validates via luxon and 400s on a bad zone, so blocking client-side avoids a guaranteed round-trip. Hints mirror the handoff: valid+unchanged → *"Detected from your device."*; valid+edited → *"Looks good."*; invalid → *"Use an IANA zone like America/New_York."* |
| C8 | Palette picker source + default | **Drive from the live `GET /v1/palettes`; preselect the first curated; append a synthetic "Custom colors" row** | The picker must show real palette names/colors (the same data 2a's `resolvePalette` uses), not the handoff's starter hexes. The endpoint carries no `is_default` flag, so preselecting the first returned palette is data-driven and avoids hardcoding a slug. |
| C9 | Create response type | **Add `CreatedNeighborhood` to `apps/api/src/types.ts`, `satisfies` it in the handler, import it type-only in web** | The create response carries `admin_secret` + `manage_url`, absent from `PublicNeighborhood`. Naming and importing the type (rather than restating it) preserves the compile-time seam — the identical move 2a used for `PublicNeighborhood`/`manage_url`. |
| C10 | `ShareCard` | **New, purely presentational; its swatch row is interactive only when an `onPreviewColor` prop is passed** | First consumer is this preview; 2c/2d reuse it with a *real* fixed color and no interactivity. Keeping data and cycle state in the route (components receive plain values) matches 2a's "route is the only data-toucher" rule. |
| C11 | Reduced motion | **Disables the auto-cycle (static first color); hover/focus still drives the preview** | The cycle is decorative motion — honor `prefers-reduced-motion` — but exploration by pointer/keyboard is interaction, not animation, and stays. |
| C12 | SSR | **Keep `ssr:false`; a client-side loader still `ensureQueryData`s the palettes** | The tz default reads `Intl` in the browser. TanStack Router loaders run client-side for `ssr:false` routes, so the palette prefetch + `useSuspenseQuery` pattern from 2a still applies. |

---

## 3. Scope

### 3.1 In scope

The complete Create screen per handoff §2: header (logo → `/`, "Back" → `/`), title + subhead, and the two-column body that wraps to stacked on mobile.

- **Form card** (left): name (optional), timezone (validated), rotation-hour stepper, palette picker (+ Custom note), and the "Create neighborhood" submit with pending/error states.
- **Success card** (left, after create): green check, "Your neighborhood is live", the public link row + copy, the private link row + lock label + copy + amber warning, and the "Open share page" / "Go to manage" CTAs.
- **Live preview** (right, both states): the new `ShareCard` cycling the selected palette with hover/focus-to-pin.
- The reusable **`ShareCard`**, **`PalettePicker`**, **`RotationHourStepper`**, **`TimezoneField`**, **`CreateSuccess`**, and the pure `formatHourLabel` / `validateTimezone` helpers.
- The one-line API change: the `CreatedNeighborhood` type + `satisfies` (C9).

### 3.2 Not in scope

- **Custom-colors editor** and everything Manage (2c) — the picker only *defers* to it (C3).
- **Marketing/Home** content and Home's example card (2d), though `ShareCard` is built here for it.
- **Slugs** (C6), a real countdown in the preview (C2), a manual theme toggle (inherits 2a's auto-only).
- Persisting the created neighborhood anywhere client-side (C5).

---

## 4. Component decomposition

Every unit is props-driven and independently testable. **The route is the only thing that touches data or timers**; components receive plain values and callbacks.

| Unit | File | Responsibility |
|---|---|---|
| Create route | `routes/create.tsx` | Owns form state, the tz seed, the create mutation, and the preview's cycle/hover state. Swaps form ↔ success in the left column; renders `ShareCard` on the right. |
| `ShareCard` | `components/ShareCard.tsx` | Presentational compact card: colored panel (`activeColor.hex` bg, `colorTheme()` ink, light/dark lockup, hex chip, `{name} · today` eyebrow, color name) + info panel (palette name, swatch row, "Rotates daily at {label}"). Swatch row is interactive when `onPreviewColor` is passed, static (`role="img"`) otherwise. |
| `PalettePicker` | `components/PalettePicker.tsx` | Vertical selectable rows: swatch strip + name + description + check badge; a Custom row (dashed `+`) that reveals the C3 note. Calls back with the chosen slug (`null` for Custom). |
| `RotationHourStepper` | `components/RotationHourStepper.tsx` | `[−] {label} local [+]`, wrapping 0–23; emits the new hour. |
| `TimezoneField` | `components/TimezoneField.tsx` | Text input + green/red validity hint (C7); reports validity up so the route can gate submit. |
| `CreateSuccess` | `components/CreateSuccess.tsx` | Success card: links + `CopyButton`s, amber warning, CTAs (`Link` to `/n/{id}` and `/manage/{id}#{secret}`). |
| `formatHourLabel` | `lib/hour.ts` | Pure: `0–23 → "7:00 AM"` (12-hour, AM/PM). Reused by the stepper and the preview. |
| `validateTimezone` | `lib/timezone.ts` | Pure: `string → boolean` against `Intl.supportedValuesOf('timeZone')` (with a `try/catch` `DateTimeFormat` fallback where unsupported). |
| `createNeighborhood` | `lib/neighborhood.ts` | `(baseUrl, body) → Promise<CreatedNeighborhood>` via the hc client `.$post`; error bodies become `ApiError`. |

Reused as-is from 2a: `CopyButton`, `colorTheme`, `PaletteColor`/`PaletteSummary`, `palettesQueryOptions`, and the existing `Logo` component (rendered inside `ShareCard` with `lockup={theme.lockup}`).

---

## 5. Data flow

### 5.1 Form + palettes

`ssr:false` (C12). On mount the route seeds `timezone` from `Intl.DateTimeFormat().resolvedOptions().timeZone`; `rotationHour` defaults to 7; `paletteSlug` defaults to the first curated palette. A client-side loader `ensureQueryData(palettesQueryOptions())` primes the picker, read via `useSuspenseQuery`.

### 5.2 The preview (C1, C11)

Route state: `cycleIndex` (advanced every ~2s by a `setInterval` in a `useEffect`; not started under `prefers-reduced-motion`) and `hoveredHex` (set on swatch hover **or** focus, cleared on leave/blur). The displayed color is `hoveredHex ?? colors[cycleIndex]`. Switching palettes resets the cycle and clears the hover. The active color's swatch is ring-highlighted. Selecting Custom (empty colors) shows a neutral placeholder panel — nothing to cycle.

### 5.3 Create (C4, C5)

```ts
const mutation = useMutation({ mutationFn: (body) => createNeighborhood(API_URL, body) })
```

The submit body is `{ name?, timezone, rotation_hour, palette? }` — `name` omitted when blank, `palette` omitted when Custom is selected. Pending → submit disabled + "Creating…"; error → inline `ApiError.message`, form intact; success → the result is held in component state and the left column renders `CreateSuccess`. Nothing is persisted (C5).

### 5.4 The type seam (C9)

`apps/api` gains:

```ts
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

The POST handler asserts `satisfies CreatedNeighborhood`; `apps/web`'s `createNeighborhood` returns it (imported type-only). A field rename in the API then fails `apps/web` typecheck, exactly as with `PublicNeighborhood`.

---

## 6. States, errors, accessibility

**States.** The palette query has a brief client-side pending state (router `pendingComponent`); the form itself needs none. Submit has pending/error (C4). Success is a full card swap (C5).

**Validation.** Name `maxLength` 120 (API limit). Timezone gates submit when invalid (C7). Rotation hour is always valid (stepper wraps). Palette always has a selection.

**Accessibility.** The preview swatches are focusable buttons when interactive, each labeled with its color name, so keyboard users get the same pin-to-color behavior as hover (C1); focus and hover share one code path. `aria-label`s carry color names since meaning must not depend on hue alone (foundation constraint). Focus rings reuse 2a's `var(--ink, var(--text))`. The amber warning is real text, not color-only. Hit targets ≥44px (the stepper buttons and CTAs). Reduced motion disables the cycle (C11).

---

## 7. Testing

Matches 2a: Vitest + Testing Library, unit-focused, `vi.mock` for Router `Link`, fake timers where time is involved.

- **Pure logic:** `formatHourLabel` (0→"12:00 AM", 7→"7:00 AM", 12→"12:00 PM", 23→"11:00 PM"); `validateTimezone` (known zone true, garbage false).
- **`RotationHourStepper`:** increment wraps 23→0, decrement wraps 0→23, label updates.
- **`TimezoneField`:** the three hint states and that invalid reports up (submit-gate).
- **`PalettePicker`:** selecting a curated row reports its slug; selecting Custom reports `null` and reveals the note.
- **`ShareCard`:** hover/focus a swatch fires `onPreviewColor`; the active swatch is highlighted; the cycle advances the active color under fake timers; static (`role="img"`) when `onPreviewColor` is absent.
- **`CreateSuccess`:** renders both link rows, the warning, and CTAs pointing at `/n/{id}` and `/manage/{id}#{secret}`; `CopyButton` copies the full URL.
- **Route (RTL):** submit posts the right body and swaps to success; the error path shows a message and keeps the form.
- **Post-deploy:** manual check that `/create` renders the form, a create call returns 201, and the resulting `/n/{id}` shows the color — then delete the test neighborhood.

---

## 8. Changes outside the Create route

- `apps/api/src/types.ts` gains `CreatedNeighborhood`; `apps/api/src/routes/neighborhoods.ts` POST handler gains `satisfies CreatedNeighborhood` (C9). No behavior change, no new endpoint.
- `apps/web/src/lib/neighborhood.ts` gains `createNeighborhood`.
- New web components/libs per §4. No changes to the Share route or foundation tokens.

---

## 9. Open items

- **`ShareCard` will be reused by 2c (Manage) and 2d (Home)** with a real, fixed daily color and no cycling. Its props are designed for that (`activeColor` fixed, `onPreviewColor` omitted), but the real-color wiring is those specs' work.
- **"Custom colors" neighborhoods ride the default palette** between create and their first Manage edit (C3) — a direct consequence of the API not accepting custom colors at create. Acceptable; the note sets the expectation.
- **The preview cannot show the true first-day color** (C1) — only an API "preview a day" capability would close this, and it is deferred (2a S4).
- **Carried forward:** the `amber-11` vs handoff `#b7791f` divergence resurfaces here (the success warning is amber) and still awaits design-owner sign-off; the handoff bundle remains gitignored (2b depends on it).
