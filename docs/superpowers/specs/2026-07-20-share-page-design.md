# Share Page (Spec 2a) — Design

**Date:** 2026-07-20
**Status:** Approved for planning
**Scope:** Spec 2a of four. Spec 2 (the four screens) was decomposed into **2a Share → 2b Create → 2c Manage → 2d Home** (S1). This spec covers only the Share page.
**Builds on:** [`2026-07-17-frontend-foundation-design.md`](2026-07-17-frontend-foundation-design.md) — shipped and deployed to `neighborhue.app` on 2026-07-17.
**Design source:** [`docs/handoff/neighborhue/design_handoff_neighborhue/README.md`](../../handoff/neighborhue/design_handoff_neighborhue/README.md) §3 "Share — public page". Where the handoff and the live API disagree on palette data, **the API wins**.

---

## 1. Why

The foundation shipped a deliberately minimal `/n/:id` — the daily hue, its computed ink, and the hex + name as text. That was a walking skeleton to prove SSR, the color model, and the type seam, and it explicitly was not an attempt at the Share page.

This spec builds the real thing. The Share page is the product's front door: it is what a neighbor opens from a group-chat link, and the only screen most people will ever see. It ships first (S1) because it delivers the most user value per task.

---

## 2. Decisions

| # | Decision | Resolution | Rationale |
|---|---|---|---|
| S1 | Spec 2 scope | **Decompose into 2a Share → 2b Create → 2c Manage → 2d Home** | Four screens + ~7 shared components is 25–35 tasks — too big for one reviewable plan. Each increment is independently shippable; shared components emerge from their first real consumer instead of being guessed at. |
| S2 | HA panel content | **Working YAML snippet + UUID row now; blueprint button deferred** | The handoff's HACS-integration-and-blueprint design depends on a component and a blueprint URL that are not confirmed to exist. A button that goes nowhere is worse than no button. The YAML works today against the already-documented `?format=hex` endpoint with vanilla Home Assistant. The UUID row is useful regardless — the future integration will want it. |
| S3 | Palette name + swatches | **Second fetch to `GET /v1/palettes`, resolve by slug** | Zero API change; the list is static and caches hard. Accepted gap: custom-color neighborhoods render "Custom colors" with no swatch row, because the public read exposes neither the palette colors nor the custom colors. |
| S4 | Footer links | **Drop both** ("Preview tomorrow's color" and "Manage") | Day-preview is impossible without an API change — the client must never replicate the API's color *selection* (foundation W10), and the API returns only today's color. A "Manage" link is useless to the public, who hold no secret. Revisit day-preview in 2c, where an owner previewing their palette across days is genuinely useful. Not spoiling tomorrow also preserves the daily surprise. |
| S5 | Theme | **Auto-only (pure CSS); "Auto" is a static label, not a control** | The foundation's auto dark mode is pure `@media (prefers-color-scheme)` — SSR-safe, no flash, no JS. A real toggle needs class-scoped tokens, a pre-paint script, hydration handling, and persistence — real work for a page whose dominant visual (the hue) does not change with theme. The handoff itself calls the chip "illustrative." |
| S6 | Countdown source | **Tick from the absolute `next_rotation_at`, never `seconds_until_rotation`** | Load-bearing (§5.2). The API sets `Cache-Control: max-age={seconds_until_rotation}`, so a cached response carries a stale *relative* value; the absolute timestamp is immune. |
| S7 | Countdown hydration | **First client render uses the SSR-computed seed; ticking starts after mount** | Server and client clocks differ; rendering the seed keeps hydration byte-identical, then the first tick silently corrects any skew. |
| S8 | Rotation rollover | **On expire: clamp display at `00:00:00`, refetch after a 2s grace, bounded backoff** | The page must not sit showing yesterday's color. The grace and backoff absorb a client clock running slightly ahead of the server's rotation. |
| S9 | Reduced motion | **Disables cross-fade and glow; the countdown keeps ticking** | The countdown is information, not decoration — freezing it would defeat the page's purpose. |
| S10 | Focus ring | **`outline: 2px solid var(--ink)`** | A fixed-color ring can vanish against an arbitrary daily hue. Reusing the computed WCAG ink guarantees contrast by the same math that guarantees the text. |
| S11 | Countdown a11y | **Not an `aria-live` region** | It updates every second; announcing each tick makes the page unusable with a screen reader. |
| S12 | Logo assets | **Copy the lockups + icon into `apps/web/public/` and commit** | They currently exist only under gitignored `docs/handoff/`, so the deployed app has no logo. |
| S13 | `ColorField` | **Evolves into `ShareColorField`; its `minHeight: 100vh` is reconciled** | Closes a Minor from the foundation's Task 6 — it is now a panel in a two-panel flex, not the whole page. |
| S14 | Shared pieces | **`CopyButton` built here; Radix `Collapsible` for the HA disclosure** | Three copy call sites on this page alone (share link, UUID, YAML) earn the abstraction. `Collapsible` is the first real Radix Primitives use, per M7/W4 (Primitives, not Themes). |
| S15 | 404 | **Styled for the share route, with a "create one" CTA** | A dead share link is a real, common path (stale link, deleted neighborhood). Turning it into the funnel is worth more than an unstyled message. |

---

## 3. Scope

### 3.1 In scope

The complete Share page at `/n/:id` per handoff §3: full-bleed two-panel layout that wraps to stacked on mobile, the hue panel (logo, hex chip, eyebrow, huge color name, hex · palette row, tagline), and the details panel (name + `Auto` label, live countdown, palette name + swatches, copy-share-link, HA disclosure). Plus the styled 404/error states, the committed logo assets, and the reusable `CopyButton`.

### 3.2 Not in scope

- **The Share Card** — a distinct component used by Home/Create/Manage previews. This page is the full-bleed layout, not the card. (2b/2d.)
- **Palette Picker** (2b), custom-colors editor and delete flow (2c), marketing content (2d).
- Day-preview, Manage link, theme toggle, blueprint button (S2/S4/S5).

---

## 4. Component decomposition

Every unit below is props-driven and independently testable. **The route is the only thing that touches data**; components receive plain values.

| Unit | File | Responsibility |
|---|---|---|
| `ShareColorField` | `components/ShareColorField.tsx` | Hue panel: logo (→ `/`), hex chip, `{Name} · Today` eyebrow, color name, hex · palette row, tagline. Sets `--hue`/`--ink`. |
| `DetailsPanel` | `components/DetailsPanel.tsx` | Neutral panel: name + `Auto` label, "Next color in" + countdown, hairline, palette + swatches, copy button, HA disclosure. |
| `Countdown` | `components/Countdown.tsx` | Renders `HH:MM:SS` from a seconds value. Presentation only. |
| `useCountdown` | `hooks/useCountdown.ts` | Seeds from SSR value, ticks 1s from `next_rotation_at`, fires `onExpire` at zero, clamps at zero. |
| `CopyButton` | `components/CopyButton.tsx` | Clipboard write, icon→check and label→"Copied!" for 1.6s, rejection fallback. |
| `SwatchRow` | `components/SwatchRow.tsx` | The 15×24 swatch run. |
| `HaPanel` | `components/HaPanel.tsx` | Radix `Collapsible`: UUID row + copy, YAML snippet + copy. |
| `Logo` | `components/Logo.tsx` | Chooses the dark-text vs light lockup from the computed ink. |
| `resolvePalette` | `lib/palette.ts` | Pure: `(slug, palettes) → { kind: 'curated', name, colors } | { kind: 'custom' }`. |
| `formatCountdown` | `lib/countdown.ts` | Pure: `seconds → "HH:MM:SS"`, zero-padded, clamped at 0. |

---

## 5. Data flow

### 5.1 Loader

Both fetches run in parallel, prime the Query cache, and are server-rendered, so the page paints complete with zero JS:

```ts
loader: async ({ context, params }) => {
  const [neighborhood] = await Promise.all([
    context.queryClient.ensureQueryData(neighborhoodQueryOptions(params.id)),
    context.queryClient.ensureQueryData(palettesQueryOptions()),
  ])
  return neighborhood   // head() reads this for OG tags (unchanged from the foundation)
}
```

`palettesQueryOptions()` is new and wraps the existing `fetchPalettes` in `lib/client.ts`. Palettes are static: a long `staleTime` makes this effectively a one-time fetch.

`resolvePalette(neighborhood.palette, palettes)` yields the display name and ordered colors for a curated palette. When `palette` is `null` the neighborhood is on custom colors: render "Custom colors" and **no** swatch row (S3).

The 404 path is unchanged from the foundation: `NeighborhoodNotFound` → `throw notFound()` → real HTTP 404. Other errors propagate (they must not be masked as 404s).

### 5.2 The countdown (load-bearing)

**Tick from `next_rotation_at`, not `seconds_until_rotation`.** The API sets `Cache-Control: max-age={seconds_until_rotation}`, so a response may legitimately be served from cache long after it was computed — still carrying its original relative value. A countdown built on that is wrong by however long the response sat in cache. The absolute `next_rotation_at` timestamp is immune.

Hydration is then handled in three steps (S7):

1. **SSR** computes the display value from `next_rotation_at` + the server clock — accurate even when the API response came from cache.
2. **First client render** uses that same seed (carried in `loaderData`), so hydrated HTML matches the server byte-for-byte.
3. **After mount**, `useCountdown` recomputes from `next_rotation_at` + the client clock and ticks. Clock skew corrects invisibly on the first tick.

**Rollover (S8):** at zero the display clamps to `00:00:00` and, after a 2-second grace, the route invalidates `['neighborhood', id]` and refetches. The new hue arrives and cross-fades in (`.5s ease`). If the refetched record still reports a rotation at or near zero (client clock ahead of the server), retry with bounded backoff rather than spinning.

---

## 6. States, errors, accessibility

**States.** SSR means the page arrives complete, so there is no initial loading state to design. `404` gets the styled "This neighborhood doesn't exist" treatment with a create CTA (S15). API 5xx/network errors get a styled error state whose retry re-runs the loader. `CopyButton` handles `navigator.clipboard` rejection — which happens in insecure contexts and under some permission setups — by selecting the text and showing a "Press ⌘C" hint rather than failing silently.

**Accessibility.** The countdown is **not** an `aria-live` region (S11); it carries a static accessible label and its ticking digits are not announced. Focus rings use `var(--ink)` so they contrast against any daily hue (S10). Hex and name are always rendered, so meaning never depends on color alone (a binding foundation constraint). Radix `Collapsible` supplies keyboard and ARIA behaviour for the HA disclosure. Hit targets are ≥44px. The `Auto` chip is a plain label — not focusable, no button semantics — because it does nothing (S5).

---

## 7. Testing

Matches the foundation's approach: Vitest + Testing Library, unit-focused, no e2e.

- **Pure logic:** `formatCountdown` (zero-padding, clamp at zero, multi-hour values) and `resolvePalette` (curated hit, unknown slug, `null` → custom).
- **`useCountdown`:** ticking and the `onExpire` callback, using fake timers.
- **Components (RTL):** `ShareColorField` renders name/hex/eyebrow and picks the correct lockup for the ink; `DetailsPanel` renders the countdown and swatches; `CopyButton` covers both the success and the **rejection** path; `HaPanel` opens and reveals the UUID and YAML.
- **Post-deploy:** the same manual curl verification the foundation used — hue present in raw pre-JS HTML, OG tags present, unknown id returns 404.

---

## 8. Changes outside the Share route

- `apps/web/public/` gains `lockup-dark-text.png`, `lockup-light.png`, and `logo-icon.png` (favicon), copied from the gitignored handoff bundle and committed (S12).
- `components/ColorField.tsx` becomes `ShareColorField` with its `minHeight: 100vh` reconciled for the two-panel layout; its existing test moves with it (S13).
- `lib/queries.ts` gains `palettesQueryOptions()`.
- **No API changes.** S2, S3, and S4 were each resolved without one.

---

## 9. Open items

- **The share link is `/n/{uuid}`.** That UUID is exactly what people paste into group chats, and this is the page where the ugliness shows. Slugs remain deferred (an API change: uniqueness, collisions, reserved words) per the foundation spec §11 — revisit if it grates in real use.
- **Custom-color neighborhoods show no swatch row** (S3). Closeable later by exposing palette/custom colors on the public read.
- **Blueprint button** waits on a published HACS component and a real blueprint import URL (S2).
- **Carried from the foundation:** the `amber-11` divergence from the handoff's `#b7791f` awaits design-owner sign-off (low impact here — the Share page shows no warnings), and the dark-mode accent scales are still declared as a used-subset rather than full ramps.
- **The handoff bundle remains gitignored.** S12 commits the assets it needs, but the design reference itself still exists only on the maintainer's machine — 2b/2c/2d depend on it.
