# Manage Page (Spec 2c) — Design

**Date:** 2026-07-21
**Status:** Approved for planning
**Scope:** Spec 2c of four. Spec 2 was decomposed into **2a Share → 2b Create → 2c Manage → 2d Home** (S1). This spec covers only the Manage page at `/manage/:id`.
**Builds on:** [`2026-07-20-create-page-design.md`](2026-07-20-create-page-design.md) and [`2026-07-20-share-page-design.md`](2026-07-20-share-page-design.md) — both shipped and deployed. Reuses their components heavily.
**Design source:** [`docs/handoff/neighborhue/design_handoff_neighborhue/README.md`](../../handoff/neighborhue/design_handoff_neighborhue/README.md) §4 "Manage", plus the mockup markup in `Neighborhue App.dc.html` (Manage screen, lines 306–470). Where the handoff and the live API disagree, **the API wins**.

---

## 1. Why

The Manage page is how an owner edits their neighborhood after creating it. It's reached only via the secret link (`/manage/{id}#{secret}`) issued on the Create success screen. It's the one screen that **writes** — name, timezone, rotation hour, palette, and custom colors — and the one that can **delete**. Because the daily color is deterministic from the palette/colors, every save changes what every neighbor's lights show, immediately.

It's the last of the three functional screens (Share, Create, Manage); Home (2d) is marketing. Building it completes the create→share→manage loop.

---

## 2. Decisions

| # | Decision | Resolution | Rationale |
|---|---|---|---|
| M1 | Save model | **Auto-save on commit** | Honors the handoff's "changes are live for everyone immediately." Discrete actions (palette pick, hour ±, add/remove/reorder a custom color) PATCH immediately; text fields (name, timezone) PATCH on blur. A single page-level indicator shows **Saving… / Saved / Couldn't save (retry)**. The PATCH returns the updated config, which the UI reflects — trusting the server rather than doing optimistic rollback. No Save button. |
| M2 | Palette vs custom | **Mutually exclusive, enforced on save** | The API resolves color as custom > palette > default, so a row with both set is ambiguous. The UI presents one choice: picking a curated palette saves `{ palette: slug, custom_colors: null }`; the custom editor saves `{ palette: null, custom_colors: [...] }`. On load, a non-empty `custom_colors` means Custom is the active mode. Selecting "Custom colors" with an empty list is a transient UI state (reveals the editor, no PATCH); the first color added persists it; removing the last color saves `custom_colors: null`. |
| M3 | Secret handling | **From the URL fragment, Bearer-only, `ssr:false`** | The secret rides in `#{secret}` so it never hits a server log (foundation W). The route stays `ssr:false`; the page reads `window.location.hash` on the client and sends `Authorization: Bearer {secret}` to the management endpoints. The secret is held in memory only — never SSR'd, logged, or persisted. |
| M4 | Two reads | **`GET /:id/manage` (Bearer, config) + `GET /:id` (public, color)** | The config endpoint returns the editable fields but **not** the computed color; the preview needs the real color, which only the public read has. The client must never recompute the color itself (that's the API's `pickColorIndex`, forbidden). Palettes come from the already-cached `GET /v1/palettes`. |
| M5 | Auth/error states | **No secret / 401 / 403 → "invalid link"; 404 → "doesn't exist"; loading spinner; retry on network error** | A management link with a missing or wrong secret is a real path (truncated copy, edited URL). The 404 reuses 2a's styled "This neighborhood doesn't exist." The invalid-link state hints that the secret is the part after `#`. |
| M6 | Live preview | **Real today-color via the public read; local label updates; refetch color after palette/custom save; drop "Preview another day"** | Name/rotation edits change only labels (updated locally). Palette/custom edits change the server-computed color, so after that PATCH succeeds the public read is refetched and the preview's color + swatches update. Day-preview is dropped for the same reason as 2a S4 (no API support; faking it is the forbidden client-side color selection). |
| M7 | Delete | **Radix `Dialog` confirm → `DELETE` → inline "deleted" state with a Create CTA** | First use of Radix `Dialog` (accessible focus-trap/escape/overlay), extending the Primitives use from 2a's `Collapsible`. On success, an inline "This neighborhood was deleted" state (with "Create a new one" → `/create`) rather than redirecting to the Home stub, which 2d hasn't built. |
| M8 | Custom colors editor | **Swatch + name + hex rows, ▲/▼ reorder, ✕ remove, an add row; drop the drag handle** | The handoff draws a drag handle but only wired ▲/▼ chevrons. ▲/▼ is the real, accessible, keyboard-operable reorder; a handle that doesn't drag is a lie. Each op auto-saves the whole `custom_colors` array (M1). |
| M9 | Hex validation | **6-digit only, matching the API's `HEX_RE`** | The API's `HEX_RE` is `/^#[0-9A-Fa-f]{6}$/` and `hexToRgb` assumes 6 digits — so the handoff's 3-digit "#F60" shorthand would be **rejected/broken** by the API. Client validation is 6-digit only (client↔API parity, like `validateTimezone` in 2b). Error copy: "Enter a valid hex like #FF6A00." A blank name defaults to "Custom". |
| M10 | TimezoneField reuse | **Add an optional prop to suppress the valid-state hint** | Manage shows only the invalid message (handoff §9), not "Detected from your device." (there's no device-detection on Manage — the zone is loaded from the server). The prop defaults to 2b's behavior, so `/create`'s usage is unchanged. |
| M11 | API change | **Export `ManageConfig` + `satisfies`, imported type-only in web** | The `GET /:id/manage` and `PATCH /:id` handlers return `serializeConfig`'s shape, currently unnamed. Naming and importing it keeps the compile-time seam (same move as `PublicNeighborhood`/`CreatedNeighborhood`). Blueprint button stays deferred (2a S2) — `HaPanel` is reused as-is. |

---

## 3. Scope

### 3.1 In scope

The complete Manage screen per handoff §4: header (logo → `/`, "View public page" → `/n/:id`), title "Manage" + amber "Secret link" chip + subtitle, and the two-column body.
- **Details card** — name, timezone, rotation hour.
- **Palette card** — the picker + the custom-colors editor.
- **Share & connect card** — public-link copy + the HA disclosure.
- **Danger zone** — delete → confirm dialog → inline deleted state.
- **Live preview** — the real today-color ShareCard.
- The auth/loading/error states, the Bearer data client, and the `ManageConfig` type.

### 3.2 Not in scope

- **Home** (2d) and its marketing content.
- **Day-preview / "Preview another day"** (M6), the **blueprint button** (M11/2a S2), **drag-and-drop** reorder (M8).
- Any new API endpoint — the management endpoints (`GET /:id/manage`, `PATCH /:id`, `DELETE /:id`) already exist; only the `ManageConfig` type is added.

---

## 4. Component decomposition

Every unit is props-driven and independently testable. **The route/orchestrator is the only thing that touches data**; presentational components receive plain values + callbacks.

| Unit | File | Responsibility |
|---|---|---|
| Manage route | `routes/manage.$id.tsx` | Thin `ssr:false` shell: reads the fragment secret, renders `ManageView`. |
| `ManageView` | `components/ManageView.tsx` | Orchestrates the three reads (config/public/palettes), seeds form state, owns the auto-save handlers + save-state, the delete flow, and renders the cards + preview. Renders the auth/loading/error/deleted states. |
| `CustomColorsEditor` | `components/CustomColorsEditor.tsx` | Rows (swatch/name/hex, ▲/▼/✕) + add row (hex/name/Add, 6-digit validation) + empty state. Emits the new `custom_colors` array up; the parent saves it. |
| `DeleteDialog` | `components/DeleteDialog.tsx` | Radix `Dialog`: "Delete {name}?" + warning + Cancel/Delete; calls `onConfirm`. |
| `SaveIndicator` | `components/SaveIndicator.tsx` | Renders idle / Saving… / Saved / error from a status prop. |
| `fetchManageConfig` / `patchNeighborhood` / `deleteNeighborhood` | `lib/manage.ts` | Bearer-authed calls; map 401/403 → auth error, 404 → `NeighborhoodNotFound`. `ManagePatch` request type. |
| `manageConfigQueryOptions` | `lib/queries.ts` | `queryOptions` keyed by `['manage', id]` (the secret is not in the key). |
| `validateHex` | `lib/hex.ts` | Pure: 6-digit `#RRGGBB`, matching the API's `HEX_RE`. |

Reused as-is (or with the one M10 prop): `PalettePicker`, `RotationHourStepper`, `TimezoneField`, `ShareCard` (real fixed color, no `onPreviewColor`), `CopyButton`, `HaPanel`, `formatHourLabel`, `validateTimezone`, `resolvePalette`, the states CSS from 2a, and `neighborhoodQueryOptions`/`palettesQueryOptions`.

---

## 5. Data flow

### 5.1 Load

`ssr:false`. `ManageView` reads `secret = window.location.hash.slice(1)`. If empty → the invalid-link state. Otherwise three `useQuery` reads (client-only, no loader — the fragment isn't available to a server loader):
- `manageConfigQueryOptions(id, secret)` → `fetchManageConfig(API_URL, id, secret)` (Bearer), keyed on `['manage', id]` (the secret is not in the key). 401/403 → invalid-link state; 404 → doesn't-exist state.
- `neighborhoodQueryOptions(id)` → the public color + countdown for the preview.
- `palettesQueryOptions()` → the picker (static, cached).

Form state seeds from the config once loaded. Custom mode = `config.custom_colors` non-empty.

### 5.2 Save (M1, M2)

One mutation per commit via `patchNeighborhood(API_URL, id, secret, patch)`:
- name / timezone → PATCH on blur (`{ name }` / `{ timezone }`).
- rotation hour → PATCH per ± click (`{ rotation_hour }`).
- curated palette → `{ palette: slug, custom_colors: null }`.
- custom color add/remove/reorder → `{ palette: null, custom_colors: [...] }` (removing the last → `{ custom_colors: null }`).

The mutation sets the page `SaveIndicator` (Saving → Saved, or error+retry) and reflects the returned config. After a palette/custom save, `queryClient.invalidateQueries(['neighborhood', id])` refetches the public read so the preview's color updates.

### 5.3 Delete (M7)

`deleteNeighborhood(API_URL, id, secret)` → on 204, `ManageView` switches to the deleted state.

### 5.4 The type seam (M11)

`apps/api` exports:

```ts
export interface ManageConfig {
  id: string
  name: string | null
  timezone: string
  rotation_hour: number
  palette: string | null
  custom_colors: Array<{ hex: string; name?: string }> | null
}
```

`serializeConfig` asserts `satisfies ManageConfig`; `apps/web`'s `fetchManageConfig`/`patchNeighborhood` return it (imported type-only). `ManagePatch` (web-side) is the PATCH body: `{ name?: string | null; timezone?: string; rotation_hour?: number; palette?: string | null; custom_colors?: Array<{ hex: string; name?: string }> | null }`.

---

## 6. States, errors, accessibility

**States.** Loading spinner while the config/public reads are in flight. Invalid-link (no secret / 401 / 403), doesn't-exist (404), and network-error (retry) states reuse 2a's styled state layout. The deleted state is a success confirmation with a Create CTA. The save indicator communicates write status without blocking editing.

**Accessibility.** The delete `Dialog` (Radix) supplies focus trap, `Escape`, labelled title/description, and returns focus on close. The custom-color ▲/▼/✕ buttons carry accessible labels ("Move {name} up", "Remove {name}"); reorder is fully keyboard-operable (no drag dependency). The "Secret link" chip is a plain label. Hex/name inputs are labelled; the invalid-hex message is associated via `aria-describedby` and the input marked `aria-invalid` (carrying forward 2b's final-review a11y pattern). The save indicator uses `aria-live="polite"`. Focus rings reuse `var(--ink, var(--text))`. Hit targets ≥44px.

**Security.** The secret is read from the fragment, kept in memory, and sent only as a Bearer header — never rendered, logged, put in a query key, or SSR'd. Delete requires the same Bearer. Distinguishing 403 (wrong secret) from 404 (no neighborhood) is acceptable: both id and secret are unguessable, so it leaks nothing useful.

---

## 7. Testing

Vitest + Testing Library, matching prior specs (`vi.mock` Router `Link`; the Bearer client mocked via `./client` like 2b's `createNeighborhood`; fake timers only where needed):

- **Pure:** `validateHex` (6-digit accept, 3-digit and garbage reject).
- **`CustomColorsEditor`:** add (valid hex → row appended, inputs cleared; invalid hex → error, no append; blank name → "Custom"), remove, reorder bounds (top ▲ / bottom ▼ are no-ops), and that each op emits the expected array.
- **Exclusivity (M2):** selecting a curated palette emits `{ palette, custom_colors: null }`; adding a custom color emits `{ palette: null, custom_colors: [...] }`; removing the last emits `{ custom_colors: null }`.
- **Auto-save state machine:** commit → Saving → Saved; error → message + retry; text fields save on blur, discrete actions on the action.
- **`DeleteDialog`:** confirm calls `onConfirm`; cancel/escape closes without calling it.
- **Auth/error states:** no secret, 401/403, 404 each render the right state.
- **`ManageView`:** seeds from config, custom mode when `custom_colors` present, preview shows the real color.
- **`lib/manage.ts`:** 401/403 → auth error, 404 → `NeighborhoodNotFound`, success → parsed config (mocking `./client`).
- **Post-deploy:** create → open `/manage/{id}#{secret}` → edit name/palette/custom → confirm via `GET /:id` → delete → 404. **Deploy BOTH workers** (the `ManageConfig` `satisfies` is API-side; web needs the type) and clean up test data.

---

## 8. Changes outside the Manage route

- `apps/api/src/types.ts` gains `ManageConfig`; `apps/api/src/routes/neighborhoods.ts` `serializeConfig` gains `satisfies ManageConfig` (M11). No behavior change, no new endpoint.
- `apps/web/src/components/TimezoneField.tsx` gains an optional prop to suppress the valid-state hint (M10); its 2b tests stay green.
- `apps/web/src/lib/queries.ts` gains `manageConfigQueryOptions`; new `lib/manage.ts`, `lib/hex.ts`, and the new components per §4.

---

## 9. Open items

- **`custom_colors` and the public read.** Custom-color neighborhoods still show no swatch row on the *public* Share page (2a S3) — the public read exposes neither palette colors nor custom colors. Manage is unaffected (it has the config), but closing S3 would also let the Share page render custom swatches.
- **Blueprint button** still waits on a published HACS component + real blueprint URL (2a S2).
- **Rapid discrete saves are serialized explicitly.** TanStack Query runs mutations in parallel unless they share a mutation `scope`, so the save mutation sets `scope: { id: 'manage-{id}' }` to queue same-neighborhood writes in order. An unretried failure keeps the error indicator visible even if a later save succeeds, so a lost write can't be masked by a subsequent "Saved".
- **The amber `--warning` (`amber-11`) vs handoff `#b7791f`** divergence recurs on the "Secret link" chip; still awaits design-owner sign-off.
- **The handoff bundle remains gitignored** — 2c/2d depend on it.
