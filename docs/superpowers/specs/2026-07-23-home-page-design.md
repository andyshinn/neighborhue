# Home Page (Spec 2d) — Design

**Date:** 2026-07-23
**Status:** Approved for planning
**Scope:** Spec 2d of four, and the last. Spec 2 was decomposed into **2a Share → 2b Create → 2c Manage → 2d Home** (S1). This spec covers only the marketing Home page at `/`.
**Builds on:** [`2026-07-21-manage-page-design.md`](2026-07-21-manage-page-design.md), [`2026-07-20-create-page-design.md`](2026-07-20-create-page-design.md), [`2026-07-20-share-page-design.md`](2026-07-20-share-page-design.md) — all shipped and deployed. Reuses `ShareCard`, `SwatchRow`, `usePaletteCycle`, `formatHourLabel`.
**Design source:** [`docs/handoff/.../README.md`](../../handoff/neighborhue/design_handoff_neighborhue/README.md) §1 "Home", plus the mockup markup in `Neighborhue App.dc.html` lines 30–124. Where the handoff and the shipped product disagree, **the shipped product wins** (H6).

---

## 1. Why

Home is the only screen a stranger sees first. Every other route assumes you already have a link: `/n/:id` needs an id, `/manage/:id` needs a secret, `/create` assumes you already decided. Home explains the product and drives one action — create a neighborhood.

It is also the last screen. `/` currently renders a 6-line placeholder (`routes/index.tsx`) that says "Neighborhue — foundation skeleton," which is what the apex domain serves today. Shipping it completes Spec 2.

Home is marketing, not function: it reads no neighborhood, writes nothing, and holds no secret. Its only data need is decorative.

---

## 2. Decisions

| # | Decision | Resolution | Rationale |
|---|---|---|---|
| H1 | Example card data | **Palettes only; a representative color from the default palette** | The daily color is chosen server-side by `pickColorIndex`; replicating it client-side is forbidden (foundation) and there is no example neighborhood to read. So the hero card is fed by the already-cached `GET /v1/palettes` and shows a real color from the real default palette — an illustration, not a claim about today. No new endpoint, no seeded record to maintain. |
| H2 | "Live example" links | **Removed; secondary CTA becomes "How it works" → `#how`** | With no example neighborhood, a link labelled "Live example" that lands on `/create` is a lie. The nav keeps only the Create button; the hero's secondary CTA scrolls to the How-it-works section already on the page. Nothing is mislabelled. |
| H3 | Hero motion | **Fixed resting color; cycles the palette only on pointer hover / focus-within** | Motion is opt-in, so nothing competes with the H1 on load and there is no implication of faster-than-daily rotation. Reuses `usePaletteCycle` (2b), which already honors `prefers-reduced-motion`. The glow behind the card breathes independently. |
| H4 | Resting color | **Rainbow's Blue `#0080FF`, resolved by hex with an index-0 fallback** | Blue reads calmly as a large hero panel against the warm Sand chrome, in both themes. Resolved by matching the hex in the default palette's colors (`findIndex`), falling back to index 0 if it is ever renamed or removed — so a palette edit degrades to "first color," never to a crash or a blank card. |
| H5 | Keyboard parity for the cycle | **`onFocusCapture`/`onBlurCapture` wired; no `tabIndex` added** | The card holds no interactive controls, so adding `tabIndex={0}` would create a focus stop that does nothing for screen-reader users (and trips Biome's `noNoninteractiveTabindex`). The cycling is decorative: hex, color name, and every swatch are readable at rest, so no information exists only in motion. Focus handlers are wired so the behavior is correct if a focusable element ever lands inside. |
| H6 | HA band copy | **Rewritten to describe the shipped REST-sensor flow; button dropped** | The handoff claims "Install the Neighborhue integration from HACS" and "one-click import the blueprint automation." **Neither exists.** What shipped in 2a is `HaPanel`: a REST sensor + automation YAML in `configuration.yaml`, disclosed on each share page. The band describes that. The "See the setup" button is dropped — in the prototype it pointed at Manage, which a public visitor cannot open, and there is no setup page to stand behind yet. |
| H7 | Footer links | **"How it works" (`#how`), "Privacy" (in-page disclosure), "GitHub" (new tab)** | All three resolve to something real. Privacy is a Radix `Collapsible` revealing a one-line statement rather than a separate page — the claim is small enough to state in full, and a "Privacy" link to a page that does not exist would be the same lie as H2. GitHub opens `github.com/andyshinn/neighborhue` with `rel="noopener noreferrer"`. |
| H8 | Privacy claim | **"No accounts, no logins, no tracking or analytics"** | Verified, not assumed: a search of `apps/web` for analytics/tracking/error-reporting SDKs (gtag, Plausible, PostHog, Sentry, Fathom) returns nothing. If any is ever added, this copy must change — it is a factual claim, not marketing. |
| H9 | Rendering | **SSR (route default), palettes fetch is failure-tolerant** | Home keeps SSR per the foundation: the hero paints with zero JS and OG tags unfurl. But the palettes fetch is *decorative*, so the loader swallows its error and the component reads with a non-suspense `useQuery`. A palettes outage degrades to a copy-only hero — a marketing page must never return 500 because an illustration failed to load. |
| H10 | Shared chrome | **Extract `SiteLogo`; adopt it in Create and Manage** | The neutral-chrome lockup CSS is duplicated verbatim in `CreateView.module.css:15-25` and `ManageView.module.css:15-25`; Home needs it twice more (44px nav, 34px footer), which would make four copies. `SiteLogo` keeps the existing `aria-label="Neighborhue home"`, so the shipped screens' tests and behavior are unchanged. |
| H11 | `SwatchRow` highlight | **Optional `activeHex`, forwarded from `ShareCard`'s raw prop only** | Home highlights the cycling color in the swatch row (the 2b interaction the product owner liked). `ShareCard`'s static branch must forward the **raw `activeHex` prop**, *not* its internal `highlight` (which falls back to `activeColor.hex`) — otherwise Manage's preview, which passes no `activeHex`, would silently gain a highlight it does not have today. |
| H12 | `usePaletteCycle` gate | **Third param `enabled: boolean = true`** | Default preserves Create's behavior exactly. When `false`, the interval is cleared and the index resets to 0. The hero composes the resting offset itself (§5.2) rather than teaching the hook about start indices. |

---

## 3. Scope

### 3.1 In scope

The complete Home screen per handoff §1, with the H2/H6 corrections:

- **Nav** — lockup (→ `/`) and a solid "Create" button (→ `/create`).
- **Hero** — eyebrow pill, H1, sub-paragraph, two CTAs, three reassurance checks, and the example share-card over a breathing color glow.
- **How it works** — section anchor `#how`, an eyebrow, and three cards.
- **Made for Home Assistant** — rocket tile, heading, corrected body copy, no button.
- **Footer** — lockup, tagline, and the three links of H7.

Plus the shared/extension work: `SiteLogo` (H10, adopted by Create and Manage), `SwatchRow`'s `activeHex` (H11), `usePaletteCycle`'s `enabled` (H12), the `pink` token import and its dark steps (§6.3), and replacing the placeholder `routes/index.tsx`.

### 3.2 Not in scope

- **No example neighborhood** — no seeded record, no `/n/:id` link from Home (H1, H2). If a permanent demo neighborhood is ever created, the hero can switch to reading it; the card component would not change.
- **No blueprint button, HACS link, or setup/docs page** (H6). No privacy page, no marketing sub-pages.
- **No manual light/dark toggle** — the page follows `prefers-color-scheme` like every other screen.
- **No API change.** Unlike 2a/2b/2c, this spec adds no endpoint, type, or field. `GET /v1/palettes` is used exactly as it exists.
- **No `og:image`.** `public/` holds only the three lockups; producing a proper 1200×630 card is a design task, not this one.

---

## 4. Component decomposition

Route is the only data-toucher; every component below takes props and renders.

| File | Responsibility |
|---|---|
| `routes/index.tsx` | Loader (palettes, failure-tolerant), `head` meta, resolves the default palette, renders `HomeView`. Replaces the placeholder. |
| `components/HomeView.tsx` | Page shell: nav, `<main>`, and section order. Takes `palette: HeroPalette \| null`. |
| `components/HomeHero.tsx` | Eyebrow, H1, sub, CTAs, reassurance row, and the example card + glow. **The only stateful component** — owns `hovering` and the cycle. |
| `components/HowItWorks.tsx` | `id="how"` section, eyebrow, three static cards. |
| `components/HaBand.tsx` | Rocket tile, heading, corrected body. Static. |
| `components/SiteFooter.tsx` | Lockup, tagline, three links; owns the Privacy `Collapsible` open state. |
| `components/SiteLogo.tsx` | The neutral-chrome lockup (H10). Props: `size?: 'nav' \| 'footer'`, `asLink?: boolean` (default `true`). `nav` = 170×44px (the shipped dimensions), `footer` = 131×34px (same aspect). `asLink` renders `<Link to="/" aria-label="Neighborhue home">`; `false` renders a `<span role="img" aria-label="Neighborhue">` — used in the footer, where a second self-link adds nothing. |

Each gets a co-located `.module.css` and `.test.tsx`, per the existing convention.

`HeroPalette` is `{ name: string; colors: PaletteColor[] }` — the two fields the card needs, derived in the route so `HomeHero` never sees a `PaletteSummary`.

---

## 5. Data flow

### 5.1 Load (H1, H9)

```
route loader ──try─→ ensureQueryData(palettesQueryOptions())   // primes SSR cache
             └catch→ swallow (decorative)
component ──→ useQuery(palettesQueryOptions())                 // non-suspense
              data ?? []  →  find(is_default) ?? [0] ?? null
              null → hero renders copy column only, no card
```

A palette whose `colors` array is empty counts as unavailable too, and takes the same no-card path. That keeps §5.2's modulo off zero, so a malformed palette degrades to the copy-only hero instead of crashing the page.

`palettesQueryOptions` already carries `staleTime: Infinity`, so this is one fetch per session and the SSR cache hydrates it. Nothing else is fetched.

### 5.2 The cycle (H3, H4, H12)

```ts
const restingIndex = Math.max(0, colors.findIndex((c) => c.hex.toUpperCase() === '#0080FF'))
const cycleIndex   = usePaletteCycle(colors.length, 2000, hovering)   // 0 when disabled
const activeIndex  = (restingIndex + cycleIndex) % colors.length
```

Offsetting by `restingIndex` means the reel *continues from* the resting color instead of snapping to index 0 on hover. At rest `cycleIndex` is 0, so `activeIndex === restingIndex` — Blue. `activeColor = colors[activeIndex]` drives the card, the glow's background, and the `activeHex` highlight in the swatch row.

### 5.3 The example card

`<ShareCard>` with: `name="Maple Street"`, `activeColor={activeColor}`, `colors`, `paletteName` (the palette's real name, e.g. "Rainbow Colors"), `rotationLabel={formatHourLabel(7)}` → "7:00 AM", `activeHex={activeColor.hex}`, and **no `onPreviewColor`** — the static branch, so swatches are not per-swatch hover targets (that is Create's interaction).

The card sits in a `<figure>` with a visually-hidden `<figcaption>`: *"Example of a neighborhood's daily color card."* Sighted users see the clean design; assistive tech gets the context that this is an illustration rather than a live reading.

---

## 6. States, errors, accessibility, motion

### 6.1 States

There are three, and only the first is common: **palette loaded** (full hero), **palette unavailable** (copy column only, full width — every other section still renders), and **reduced motion** (§6.2). There is no loading spinner: SSR delivers the palette in the initial HTML, and on a cold client the copy column renders immediately with the card appearing when data lands.

### 6.2 Motion

- Glow: `blur(72px)`, `opacity .34`, 6s ease-in-out breathe.
- Color/ink cross-fade: `.5s` on the card and glow.
- Smooth `#how` scrolling via `html { scroll-behavior: smooth }` in `reset.css`, wrapped in `@media (prefers-reduced-motion: no-preference)`.
- Under `prefers-reduced-motion: reduce`: breathing stops, cross-fades become instant, `usePaletteCycle` already refuses to start, and scrolling is instant. The page is fully static.

### 6.3 Tokens

New: `@import "@radix-ui/colors/pink.css"` for the middle how-it-works tile. Tiles use **step-3 as tint, step-11 as icon** (indigo / pink / amber), which is contrast-safe in both themes and avoids the handoff's raw light-mode hexes.

`tokens.css` states its own rule: dark scales ship class-scoped, so any accent step used must be re-declared in the `@media (prefers-color-scheme: dark)` block or it silently falls back to its light value. The steps this spec adds there, from `@radix-ui/colors@3.0.0` sRGB (P3 deliberately not mapped, matching the file):

| Token | Dark value |
|---|---|
| `--indigo-3` | `#182449` |
| `--indigo-11` | `#9eb1ff` |
| `--pink-3` | `#37172f` |
| `--pink-11` | `#ff8dcc` |

`--amber-3` (`#302008`) and `--amber-11` (`#ffca16`) are already declared.

### 6.4 Accessibility

- One `<h1>`; sections use `<h2>`; the nav is `<nav>`, content `<main>`, footer `<footer>`.
- Reassurance checks and all decorative icons are `aria-hidden`; the tiles' meaning is carried by their adjacent text.
- The `#how` target gets `scroll-margin-top` so the sticky-free nav does not clip the heading.
- Hit targets ≥ 44px on both CTAs and the nav button.
- The glow is a positioned, empty `aria-hidden` div — never an element carrying content.
- Contrast: body copy uses `--text-muted`, not the handoff's raw `#8a867f`, which fails AA on the dark surface.

---

## 7. Testing

Vitest + RTL, matching the shipped screens' conventions (`vi.mock` the Router `Link`, per 2b).

- **`HomeHero`** — renders H1/sub/both CTAs/three checks; renders the card when a palette is passed and omits it when `null`; **cycles on `mouseEnter` and stops (returning to the resting color) on `mouseLeave`**; resting color is Blue, not index 0; falls back to index 0 when the resting hex is absent.
- **`HowItWorks`** — three cards with the exact titles; the section carries `id="how"`.
- **`HaBand`** — renders heading and body; **asserts no button/link is rendered** (H6 is a deliberate omission and must not silently regress).
- **`SiteFooter`** — the three links; GitHub is `target="_blank"` with `rel="noopener noreferrer"`; Privacy toggles the statement.
- **`SiteLogo`** — link variant exposes `aria-label="Neighborhue home"`; `asLink={false}` renders no link.
- **`SwatchRow`** — `activeHex` marks exactly one swatch active; **absent `activeHex` marks none** (the H11 regression guard for Manage).
- **`usePaletteCycle`** — `enabled: false` does not advance and resets to 0; omitting the param preserves current behavior.
- **Route** — renders the full page when palettes resolve, still renders when the palettes fetch rejects (H9), and still renders when the default palette has an empty `colors` array (§5.1).

At deploy: verify the raw SSR HTML contains the H1 and section copy (writing bytes to a file, not `curl | grep` — that false-empties on these gzipped responses).

---

## 8. Changes outside the Home route

1. **`components/SwatchRow.tsx`** — optional `activeHex` (H11).
2. **`components/ShareCard.tsx`** — static branch forwards the raw `activeHex` to `SwatchRow` (H11). Create and Manage call sites unchanged.
3. **`hooks/usePaletteCycle.ts`** — third param `enabled = true` (H12). Create's call unchanged.
4. **`components/CreateView.tsx` + `ManageView.tsx`** — swap the hand-rolled header lockup for `<SiteLogo />`; delete the duplicated `.logo` blocks from both stylesheets (H10).
5. **`styles/tokens.css`** — pink import + four dark steps (§6.3).
6. **`styles/reset.css`** — motion-gated smooth scrolling (§6.2).

---

## 9. Copy (verbatim)

**Nav:** "Create"

**Hero**
- Eyebrow: "One color a day"
- H1: "The whole neighborhood glows the same color."
- Sub: "Neighborhue gives your street one shared color that changes every morning. Point your smart lights at a single link — Home Assistant, LED bulbs, whatever you've got — and the whole block lights up together."
- CTAs: "Create a neighborhood" / "How it works"
- Checks: "No accounts" · "No logins" · "About a minute to set up"
- Figcaption (visually hidden): "Example of a neighborhood's daily color card."

**How it works** — eyebrow "How it works"
1. "Pick a palette" — "Seven vivid palettes tuned for cheap RGB bulbs — or define your own custom colors." *(Seven is verified against the live API: 7 curated palettes, default `rainbow`.)*
2. "Share the link" — "Drop the public link in the group chat. Neighbors just open it — no app to install."
3. "Point your lights" — "Home Assistant reads today's color and applies it to your lights automatically each morning." *(Corrected during the final review: the handoff's "Home Assistant or any bulb reads today's color" credits the bulb with doing the reading. The "cheap bulbs work" reassurance is carried by the HA band instead.)*

**Made for Home Assistant** (H6, rewritten)
> "Every neighborhood page carries a ready-made REST sensor and automation — copy the YAML into your `configuration.yaml` and Home Assistant applies today's color each morning. Plain RGB bulbs work too."

**Footer**
- Tagline: "A shared color for the whole neighborhood."
- Links: "How it works" · "Privacy" · "GitHub"
- Privacy statement: "No accounts, no logins, no tracking or analytics. A neighborhood stores only your name, time zone, rotation hour, and colors — and anyone with its secret link can delete it permanently." *(Corrected during the final review: the original "stores only what you enter" was over-claiming — the row also holds the `id`, the `admin_secret`, and a `created_at` timestamp. The revised wording keeps the promise and is exactly true.)*

---

## 10. Open items

- **`og:image`** — deferred (§3.2). Home ships with OG title and description only; unfurls will show text, not a card.
- **Example neighborhood** — if a permanent demo is ever seeded, H1/H2 can be revisited to make "See a live example" real. Deliberately not blocking this spec.
- **`--warning`** — still differs from the handoff's `#b7791f` (carried from 2a §11). Home does not use it, so it stays open.
