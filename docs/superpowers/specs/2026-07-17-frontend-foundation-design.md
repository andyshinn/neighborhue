# Frontend Foundation — Design

**Date:** 2026-07-17
**Status:** Approved for planning
**Scope:** Spec 1 of 2. This spec builds the shell and ships a walking skeleton. A second spec owns the four screens.
**Amends:** M6, M8, M9, M14 in [`2026-07-16-monorepo-restructure-design.md`](2026-07-16-monorepo-restructure-design.md) — see §10.2.
**Design source:** [`docs/handoff/neighborhue/design_handoff_neighborhue/`](../../handoff/neighborhue/design_handoff_neighborhue/) — `README.md` is the spec; `Neighborhue App.dc.html` is the primary visual reference. Its `support.js` runtime is reference only and must not be ported.

---

## 1. Why

The backend is deployed at `api.neighborhue.app`. `apps/web` exists as a package boundary and a typed client, nothing more — M12 deliberately left it that way so a frontend spec could land without merge conflicts. This is that spec.

A design handoff now exists covering all four screens at high fidelity: exact colors, typography, spacing, radii, shadows, copy, and interactions. It is comprehensive enough that the screens are largely a transcription job — **provided the shell underneath them is right**. That shell does not exist: no framework, no build, no deploy target, no token layer, no color model.

**This spec builds only the shell.** It ships one deliberately minimal route as proof, and hands the four designed screens to Spec 2. The split exists because the screens share one design system and one color model; designing them before the shell is proven would mean re-deciding both under pressure.

---

## 2. Decisions

| # | Decision | Resolution | Rationale |
|---|---|---|---|
| W1 | Spec scope | **Two specs: foundation (this), then screens** | The four screens share a token layer and a color model. Prove those once, in isolation, against the live API. |
| W2 | Framework | **TanStack Start** (brings Vite + React + TanStack Router) | Selective SSR is per-route (§4.2). Overturns M8's *rationale*, not its conclusion (§10.2). |
| W3 | SSR posture | **Selective:** SSR on `/` and `/n/:id`; `ssr: false` on `/create` and `/manage/:id` | §4.2. Each route's setting has a distinct, stated reason. |
| W4 | Radix Themes | **Rejected. Primitives + Colors only** | Inventory: 2 of ~15 handoff pieces are near-fits, both restyled anyway (§2.1). M7 reached the same conclusion for a narrower reason. |
| W5 | Styling | **CSS Modules + CSS custom properties** | The daily hue is one variable that cascades; the `.5s` cross-fade is a plain transition; `prefers-reduced-motion` is one media query. The handoff's exact one-off values are the native idiom. Zero runtime, zero Vite config. |
| W6 | Neutrals | **Adopt Radix Sand**, replacing the handoff's hand-picked warm ramp — with one stated exception, the light-mode card surface (§5.1) | Drift is imperceptible (§5.1) and the dark scale comes free. The handoff specifies light-mode hexes only while requiring auto dark mode; someone has to fill that gap. |
| W7 | Data layer | **TanStack Query everywhere, via `routerWithQueryClient`** | One idiom across all four routes. Loaders prime the cache; SSR'd data hydrates into the same cache the client mutates. |
| W8 | Worker → API | **Public fetch to `api.neighborhue.app`** | Hits the edge cache the API already populates (`Cache-Control: max-age={seconds_until_rotation}` + ETag). A service binding would bypass that cache and re-run D1 queries on every SSR render. |
| W9 | Manage URL | **`{base}/manage/{id}#{secret}`** | The id is required by every management endpoint; the secret is a bearer credential and fragments are never transmitted to any server (§4.4). |
| W10 | Color model | **Pure `colorTheme(hex)` function. Never replicate the API's color *selection* client-side.** | The API returns the color; only the readable-ink derivation is client-side, and it is stateless. Replicating `pickColorIndex` would need a runtime import from `apps/api`, which the monorepo spec §4 forbids (§6.2). |
| W11 | Type / radius scale | **No invented scale.** Global tokens for what repeats; literal values for one-offs | The handoff's values are deliberate one-offs and stated ranges. A token three components override is indirection, not a scale. Spec 2 reveals what actually repeats. |
| W12 | Testing | **Vitest + RTL, unit-focused**, plus a required manual SSR verification (§9.2) | Matches `apps/api`. The WCAG math is pure, exact, and the real target. Accepted gap: no automated SSR test. |
| W13 | Fonts | **Self-hosted `@fontsource-variable/geist` + `geist-mono`** | No third-party request, no FOUT, CSP stays tight. |
| W14 | Router | **TanStack Router, as bundled with Start** | wouter (2.5KB) and react-router v8 were considered and are sufficient in isolation; adopting Start settles routing by inclusion. |

### 2.1 Why Radix Themes was rejected (W4)

M7 rejected Themes because its `accentColor` takes predefined named scales and Neighborhue's accent is an arbitrary daily hex. That reasoning is correct but narrower than the real case. Inventory against the handoff:

| Handoff piece | Themes equivalent | Verdict |
|---|---|---|
| Delete confirm modal | `AlertDialog` | Near-fit; radius 20 + `0 30px 80px rgba(0,0,0,.35)` + `blur(3px)` overlay = restyled |
| Amber warning | `Callout` | Near-fit; `#fff8ed` / `#f2d69a` / `#8a6d3b` are not amber steps = restyled |
| CTA button | `Button` | Near-black `#1c1c1c`, radius 13, height 52 — not an accent scale, not size-4's 48px |
| Cards | `Card` | Radius 22 + custom shadow = restyled |
| Palette picker, rotation stepper, share card, color field, HA panel, hex chip, eyebrow pill, swatch rows | *none* | Fully custom |

Two near-fits out of ~15, both restyled. Customizing a Themes component past its props means targeting `.rt-*` internal classes, which are not a public API. **The deeper reason: this handoff specifies exact one-off values throughout, which is the opposite of what a scale-based system exists to do.**

The Primitives that earn their place are few and should be adopted honestly: `AlertDialog` (focus trap, escape, scroll lock), `RadioGroup` (the palette picker is single-select with roving arrow-key focus), `Collapsible` (the HA disclosure), plus `Label` and `VisuallyHidden`. Everything else is our CSS — which is fine, because the handoff already specifies every value.

---

## 3. Scope — the walking skeleton

### 3.1 What ships

`apps/web` becomes a deployed TanStack Start app on `neighborhue.app`, exercising every foundation risk end-to-end:

- Start + Vite + React + Cloudflare Workers, deployed to the apex.
- All four routes exist and route correctly. Three are bare stubs.
- **`/n/:id` renders the minimal honest Share page**: background = today's hue from the live API, foreground ink computed for contrast, hex and name as text. No layout, no countdown, no details panel, no glow, no logo.
- Token layer complete: Radix Colors mapped to semantic custom properties, light and dark.
- `colorTheme()` + the WCAG foreground algorithm, unit-tested.
- Geist and Geist Mono loading.
- Data layer: `hc<AppType>` + Query + `routerWithQueryClient`; loader on `/n/:id`.
- OG meta tags on `/n/:id` derived from loader data.
- Error and 404 plumbing (unstyled).

**Why this slice:** it is the thinnest thing that fails loudly if any foundation piece is wrong. If a hex renders correctly in a browser, then SSR, the loader→Query hydration, the type seam, the color model, the token layer, the fonts, and the deploy all work.

### 3.2 Explicitly not in scope

The four screens' designs — layout, typography, countdown, palette picker, share card, HA snippet, custom-colors editor, glow, cross-fade, delete modal, and all copy. Spec 2 owns them. The skeleton's `/n/:id` is *not* an attempt at the Share page and must not be mistaken for one.

### 3.3 Prerequisite

The skeleton needs a real neighborhood to render. Create one against production via `POST /v1/neighborhoods` and record its id for the plan; it doubles as the fixture for §9.2.

---

## 4. Architecture

### 4.1 Package layout

```
apps/web/
├── package.json          # @neighborhue/web
├── wrangler.jsonc        # apex neighborhue.app; nodejs_compat; Start server entry
├── vite.config.ts        # cloudflare({viteEnvironment:{name:'ssr'}}), tanstackStart(), viteReact()
├── tsconfig.json         # extends ../../tsconfig.base.json (unchanged)
├── vitest.config.ts
└── src/
    ├── routes/           # __root, index, create, n.$id, manage.$id
    ├── styles/           # tokens.css (Radix Colors → semantic), reset, fonts
    ├── lib/
    │   ├── client.ts     # hc<AppType> (exists; comment updated per §7.1)
    │   ├── queries.ts    # query key factory + query options
    │   └── errors.ts     # typed parser for the API's {error, message}
    └── color/
        ├── theme.ts      # colorTheme(), relativeLuminance()
        └── theme.test.ts
```

Per M15, `wrangler` is a devDependency of `apps/web`, not hoisted.

### 4.2 Routes and SSR posture

| Route | SSR | Why |
|---|---|---|
| `/` | **SSR** | Marketing page. SEO and OG unfurls are its purpose. |
| `/n/:id` | **SSR** | OG unfurl with today's color; the hue paints with zero JS. The reason Start is adopted. |
| `/create` | `ssr: false` | The timezone default comes from `Intl.DateTimeFormat().resolvedOptions().timeZone` — browser-only. SSR would render a wrong default then hydrate over it: a guaranteed hydration mismatch and a visible flash. No SEO value to trade against it. |
| `/manage/:id` | `ssr: false` | The secret must never be evaluated server-side. |

### 4.3 Deploy

Two Workers, one repo, deployed independently — the per-Worker root directory + build watch paths setup already described in the monorepo spec §1. `apps/web` takes the apex, which [`apps/api/wrangler.jsonc`](../../../apps/api/wrangler.jsonc) already reserves in a comment: *"apex neighborhue.app is reserved for the frontend SPA."*

### 4.4 The manage secret (W9)

Every management endpoint is `/v1/neighborhoods/:id/...` and needs the id **and** the bearer secret. The API's current `manage_url` carries only the secret, so a page at `/manage/{secret}` has nothing to fetch with. The id must be in the URL.

The secret's placement is a separate question. `ssr: false` prevents us *evaluating* it server-side, but the browser still requests the full URL to fetch the document — so a path-borne secret reaches our Worker and any request log on every cold load. This is not caused by Start (M9's static-assets SPA routing had the identical property), and it is our own infrastructure rather than a third party. But it is a bearer credential in a server-visible position, on a link the handoff calls "the only way back in" and unrecoverable.

**Resolution: `#fragment`.** Fragments are never transmitted to any server. The route is `/manage/:id`; the secret is read from `location.hash`. Cost: some link-rewriting tools drop fragments when pasted around.

---

## 5. Token layer

CSS custom properties in `src/styles/tokens.css`, imported from `@radix-ui/colors` (`sand.css`, `sand-dark.css`, `sand-alpha.css`, `sand-dark-alpha.css`, and the accent scales). Semantic names, mapped independently per theme.

### 5.1 Neutrals — verified mapping

The handoff's hand-picked ramp against the real Sand scale. One value is a verbatim match:

| Handoff | Sand step | Value | Drift |
|---|---|---|---|
| Body behind `#e9e8e6` | `sand-4` | `#e9e8e6` | **exact** |
| Page bg `#f1efec` | `sand-3` | `#f1f0ef` | imperceptible |
| Surface-2 `#fbfaf8` | `sand-2` | `#f9f9f8` | imperceptible |
| Text `#1c1c1c` | `sand-12` | `#21201c` | slightly warmer |
| Muted `#57534e` | `sand-11` | `#63635e` | slightly lighter |
| Faint `#78756f` | `sand-10` | `#82827c` | slightly lighter |
| Faintest `#9a968e` | `sand-9` | `#8d8d86` | slightly lighter |
| Hairline `rgba(0,0,0,.08–.14)` | `sand-a4`/`a5` | ~.10/.13 alpha | alpha composites over any background |

**The one exception to W6: the light-mode card surface stays pure `#ffffff`.** `sand-1` is `#fdfdfc`, which is imperceptibly different — but the handoff's crisp white card on a warm `#f1efec` page is a deliberate contrast the designer chose, and white costs nothing to keep because dark mode reads its value from the scale regardless. Every other neutral comes from Sand.

Elevation flips direction between themes, so surfaces map per-theme rather than by step number:

```css
:root {
  --page-bg:   var(--sand-3);   /* #f1f0ef */
  --surface:   #ffffff;         /* the handoff's crisp white card */
  --surface-2: var(--sand-2);
}
@media (prefers-color-scheme: dark) {
  :root {
    --page-bg:   var(--sand-1);   /* #111110 */
    --surface:   var(--sand-2);   /* #191918 — elevated above page */
    --surface-2: var(--sand-3);
  }
}
```

**The near-black CTA is the argument for W6 in one component.** `#1c1c1c` is invisible in dark mode and needs an inversion rule. The scale supplies it free:

```css
.cta { background: var(--sand-12); color: var(--sand-1); }
/* light: near-black on near-white.  dark: near-white on near-black.  No branch. */
```

### 5.2 Accents

| Handoff | Radix | Match |
|---|---|---|
| Indigo `#3e63dd` | `indigo-9` | **exact** |
| Danger `#e5484d` | `red-9` | **exact** |
| Danger tint `#fdecec` | `red-3` `#feebec` | imperceptible |
| Success tint `#e7f7ec` | `green-3` `#e6f6eb` | imperceptible |
| Success text `#22a565` | `green-10` `#2b9a66` | close |
| Link hover `#3a5ccc` | `indigo-10` `#3358d4` | close |
| **Warning text `#b7791f`** | **`amber-11` `#ab6400`** | **visibly different — see §11** |

### 5.3 Type, radius, shadows (W11)

Global tokens for what genuinely repeats: font families, the two shadows (`--shadow-card`, `--shadow-modal`), hairline, and the semantic colors. **Literal values in component CSS** for the handoff's one-offs (`58px`, `-.035em`, `104px`) and its stated ranges ("cards 16–24", "chips 16–20"). Spec 2 promotes what proves repetitive.

Fonts: `@fontsource-variable/geist` (v5.2.9) and `@fontsource-variable/geist-mono` (v5.2.8), self-hosted, latin subset.

---

## 6. Color model

### 6.1 `colorTheme()` is a pure function, not a hook

The handoff proposes `useDailyColor(palette, customColors, dayIndex)`. That is the **prototype's** shape, where the browser computed the color for demo purposes. The handoff says so itself: *"in production trust the API's `color` and `seconds_until_rotation`. Keep the readable-foreground computation client-side since the API returns the hue only."*

In production the API returns `color: {hex, rgb, hsl, name}`. The remaining derivation is stateless presentation, so it is a pure function — no React needed to test it, and the WCAG math pins directly against known hexes.

```ts
export function colorTheme(hex: string): ColorTheme {
  const L = relativeLuminance(hex)                       // sRGB linearized, 0.2126R+0.7152G+0.0722B
  const ink = (L + 0.05) / 0.05 >= 1.05 / (L + 0.05)     // contrast vs black ≥ contrast vs white
    ? '#181310' : '#ffffff'
  return {
    ink,
    inkMuted: alpha(ink, 0.68),
    chipBg:   alpha(ink, 0.12),
    lockup:   ink === '#ffffff' ? 'light' : 'dark-text',
  }
}
```

Applied by setting custom properties on one element; everything downstream re-themes by cascade:

```tsx
<main style={{ '--hue': color.hex, '--ink': t.ink, '--ink-muted': t.inkMuted }}>
```

Note: the algorithm computes contrast against pure black but renders `#181310` (warm near-black), so true contrast is marginally below the computed figure. This is the handoff's stated algorithm and the discrepancy is negligible; it is recorded here so it is not rediscovered as a bug.

Per the handoff, hex and name are always rendered — meaning never depends on color alone.

### 6.2 We never replicate the API's color selection (W10)

The API picks via `pickColorIndex(id, dayIndex, len)` — a hash of the neighborhood id. Replicating it client-side would need a **runtime** import from `@neighborhue/api`, which the monorepo spec §4 forbids in load-bearing terms: it would drag untranspiled TypeScript into Vite's graph and trigger `packages/shared` (M3). Two consequences Spec 2 inherits:

- **Manage's live preview** = optimistic PATCH + Query invalidation; the API returns the real new color. This is what "changes are live for everyone immediately" implies anyway, so the constraint costs nothing.
- **Create's preview cannot predict the color** — no id exists until submit. It is necessarily illustrative, and Spec 2 must write copy that does not imply otherwise.

---

## 7. Data flow

`routerWithQueryClient(router, queryClient)`. Loaders call `context.queryClient.ensureQueryData(...)`; components read via `useSuspenseQuery`. SSR'd data hydrates into the same cache the client mutates.

`/n/:id`'s loader feeds both the component and `head`, which emits the OG tags from `loaderData`.

The API base URL is public and stable, so `VITE_API_URL` works as a build-time replacement in **both** bundles — client and Worker — because Vite inlines it at compile time rather than reading a runtime env.

### 7.1 The type-seam wart comes due

The monorepo spec §5 deferred exactly one thing to this spec:

> **Known wart, accepted:** `GET /:id` returns `c.json`, `c.text` (for `?format=hex|rgb`), and `c.body(null, 304)`, so its inferred client type is a union across formats and status codes and will be awkward to consume. … Address the ergonomics when the frontend actually consumes that route.

This is that moment, and it is the route the skeleton depends on. **Expectation:** `.json()` will not typecheck directly — Hono's `ClientResponse` carries the response format in its type, and `.json()` is not callable on a union that includes a `text` variant, so it needs narrowing first.

**This expectation is unverified.** The plan's first task must be to write the call and read what `tsc` actually reports, *then* choose the fix. Do not prescribe a remedy for a compiler error that has not been reproduced.

**Constraint on the fix:** "split the formats into separate routes" is not available. `?format=hex|rgb` is documented public API ([`README.md:46`](../../../README.md)) that the Home Assistant integration depends on. The fix belongs on the client side — most likely a small narrowing wrapper in `apps/web/src/lib/` — not in a breaking API change.

[`apps/web/src/lib/client.ts`](../../../apps/web/src/lib/client.ts)'s comment (*"Vite is deliberately not installed here yet"*) stops being true and is updated as part of this work.

---

## 8. Error handling

The foundation ships **plumbing**; Spec 2 designs the views. Router's `errorComponent` and `notFoundComponent`, a typed parser for the API's `{ error, message }` shape, and bare unstyled 404/error states.

Handoff states deferred to Spec 2: inline validation, "copied!" feedback, and the empty custom-colors state.

**SSR correctness:** `/n/:id` for an unknown id must return an actual **HTTP 404**, not a 200 rendering a 404-shaped page. This is the difference between a broken share link being honest and being invisible to every tool that checks status codes.

---

## 9. Testing and verification

### 9.1 Automated (W12)

Vitest + RTL in `apps/web`, matching `apps/api`.

The real target is the WCAG math, which is pure and exact. **The seeded palettes are a ready-made fixture set** — all 7 palettes' colors are known hexes with known-correct ink, including the hard cases:

| Fixture | Expected ink | Why it's a good test |
|---|---|---|
| `#FFD700` (Yellow) | `#181310` | High-luminance; white ink would fail AA |
| `#4B0082` (Indigo) | `#ffffff` | Low-luminance |
| `#FDF4DC` (Warm White) | `#181310` | Near-white extreme |
| `#00FF00` (Green) | `#181310` | Max green — luminance dominated by the 0.7152 coefficient |
| `#0000FF` (Blue) | `#ffffff` | Max blue — the 0.0722 coefficient, the inverse case |

Plus: `colorTheme()` returns the correct lockup for each ink, and RTL renders the skeleton route's hex and name from mocked data.

### 9.2 Manual SSR verification — required

W12 accepts no automated SSR test, so this is a **required step**, not a suggestion. It checks the entire claim Start was adopted to make, without a browser:

```bash
curl -s https://neighborhue.app/n/{id} | grep -o '#[0-9A-F]\{6\}'   # hue present in HTML, pre-JS
curl -s https://neighborhue.app/n/{id} | grep -o 'og:[a-z]*'         # OG tags present
curl -s -o /dev/null -w '%{http_code}' https://neighborhue.app/n/nonexistent   # must be 404
```

If the hex appears in raw curl output, SSR works.

---

## 10. Changes outside `apps/web`

### 10.1 One API change

```ts
// apps/api/src/routes/neighborhoods.ts — POST /
manage_url: `${c.env.MANAGE_URL_BASE}/manage/${id}#${adminSecret}`   // was: /manage/${adminSecret}
```

Plus its test. **No CORS work is needed:** `CORS_ORIGIN` and `MANAGE_URL_BASE` are already `https://neighborhue.app`, the browser-side Create/Manage writes match that origin, and the SSR loader fetch is server-side, sends no `Origin`, and takes the public-GET path.

### 10.2 Monorepo spec amendments

These must be **amended in place, not silently contradicted** — a future reader who sees SSR in the code will otherwise conclude M8 was ignored.

| | Was | Becomes |
|---|---|---|
| M6 | Vite + React + Radix Primitives + Radix Colors | TanStack Start (brings Vite + React) + Radix Primitives + Radix Colors |
| M8 | Next.js / OpenNext **Rejected** — "No SSR requirement" | Next.js / OpenNext still rejected; the **rationale is overturned**. SSR is adopted selectively via Start, which delivers the dynamic OG tags M8 conceded were "the one real argument" — declaratively from the route loader, rather than via hand-rolled `run_worker_first` meta injection. |
| M9 | Worker with static assets, `not_found_handling: "single-page-application"` | Start server entry; SSR on `/` and `/n/:id`; `ssr: false` elsewhere |
| M14 | Web framework install deferred to the frontend spec | **Discharged** — this is that spec |

M7 (Themes vs Primitives) stands, with §2.1 recorded as the fuller reasoning. M3 (no `packages/shared`) stands and is reinforced by §6.2. M15 (per-app `wrangler`) stands and applies to `apps/web`.

---

## 11. Open items

- **The warning amber (§5.2).** `amber-11` `#ab6400` is visibly different from the handoff's `#b7791f` — a darker, more orange tone — and it lands on the "save this link, it cannot be recovered" warning, arguably the product's most important copy. Adopted for the free dark scale; flag for the design owner. Reverting means hand-authoring one light/dark pair.
- **Palette hexes.** The handoff's palette values are explicitly "a curated LED-friendly starter set — swap for canonical values if you have them." The seeded palettes in [`apps/api/seed/palettes.ts`](../../../apps/api/seed/palettes.ts) **are** canonical and differ (e.g. handoff Scarlet `#FF2D2D` vs seeded Red `#FF0000`), as do the names ("Rainbow" vs "Rainbow Colors"). **The API is the source of truth.** Spec 2 must also handle `mixed` having 20 colors where the handoff's swatch row shows 7.
- **Share URL shape.** The handoff specifies `/n/[slug]`; no slugs exist — ids are UUIDs, so the route is `/n/{uuid}`. Adding real slugs would be an API change (uniqueness, collisions, reserved words) and is out of scope. Revisit only if UUID share links prove too ugly for group chats.
- **SVG lockups.** The handoff ships PNGs and notes: *"Prefer shipping SVG versions of the lockup if available; ask the design owner."* Foundation uses the PNGs; Spec 2 should ask.
- **HA blueprint deep-link.** The handoff's HA snippet needs a real HACS integration and a blueprint import URL. Neither is confirmed to exist. Spec 2 blocker, not a foundation one.
- **Prototype's dev-only screen switcher.** The handoff is explicit: *"the switcher is a prototype aid; do not build it."*
