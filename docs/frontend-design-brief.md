# Design brief: Neighborhue — frontend SPA

> Handoff brief for a design tool. The frontend lives at `apps/web` in this monorepo
> (see [`docs/superpowers/specs/2026-07-16-monorepo-restructure-design.md`](superpowers/specs/2026-07-16-monorepo-restructure-design.md))
> and is out of scope for the backend v1. This brief depends only on the product concept and the API
> contract (see [`docs/superpowers/specs/2026-07-15-neighborhue-backend-design.md`](superpowers/specs/2026-07-15-neighborhue-backend-design.md)),
> so it can be designed in parallel with the backend build.

## Product
Neighborhue gives a neighborhood a single shared color that changes once a day.
Neighbors point their smart lights (Home Assistant, LED bulbs) at the same URL and
all glow the same hue, rotating to a new color each morning at a local hour they choose.
The color is deterministic (computed from the neighborhood + the day) — no accounts,
no logins. A neighborhood is owned by whoever holds its secret management link.

## Who it's for
Smart-home hobbyists and their neighbors. Mostly opened on phones (the share page
especially). Friendly and low-effort — someone should be able to spin one up in under
a minute and share it in a group chat.

## Platform
Responsive single-page web app (React / Next.js-friendly). Mobile-first, works great
on desktop. Light and dark mode.

## Core screens

1. **Get Started / Create**
   Form: neighborhood name (optional), timezone (IANA — default to the browser's zone),
   rotation hour (0–23, default 7 AM local, "the color flips at this time each day"),
   and a palette picker (see below). On submit, show a success state with:
   - the shareable link (public, read-only)
   - the private management link (contains a secret token) with a clear
     "save this — it's the only way back in" warning + copy button.

2. **Today's Color (public share page)** — the hero of the product
   A big, full-bleed color area showing today's color. Include: the color's name + hex,
   the neighborhood name, a live "next color in HH:MM:SS" countdown, the palette name,
   a "copy share link" button, and an "Add to Home Assistant" action that reveals a
   prefilled, copy-paste YAML snippet (a REST sensor + a light automation). A subtle
   "how it works" line. Lean into a warm glow / lightbulb feeling.

3. **Manage** (opened via the secret link)
   Edit name, timezone, rotation hour, and palette — or define custom colors
   (add hex + name, reorder). Live-preview today's color as edits are made. Show the
   share link + the HA snippet. A delete action with confirmation.

4. **Palette picker** (used in Create + Manage)
   The seven curated palettes shown as horizontal swatch rows with names:
   Rainbow (default), Rainbow + Warm White, Mixed (Surprise — the "random" one),
   Vivid / Neon, Warm, Cool, Primary & Secondary. Plus a "Custom colors" option.
   All palette colors are high-saturation and chosen to reproduce well on cheap RGB
   LED bulbs — the design can lean into vivid swatches.

## Data it renders (real API shape, use these fields)
- Public read → `{ name, timezone, rotation_hour, color:{hex, rgb:[r,g,b], hsl:[h,s,l], name}, rotated_at, next_rotation_at, seconds_until_rotation, palette, day_index }`
- Create → returns the config + `admin_secret` + `manage_url`
- List palettes → `[{ slug, name, description, colors:[{hex, name}] }]`

## Visual direction (default — steer as you like)
Color-forward: the current daily color should theme the share page (background wash /
accents), so the site literally changes color each day. Friendly, neighborly, calm-but-
playful. Clean type, generous space, one big color moment per screen. Because the theme
hue varies daily, foreground text must adapt for contrast — never rely on color alone;
always show the hex/name too.

## States to cover
Loading, network error, 404 (unknown neighborhood), inline validation (bad timezone /
hour out of range / malformed hex), "copied!" feedback, and an empty custom-colors state.

## Accessibility & responsiveness
WCAG-AA contrast against the variable daily hue (compute a readable foreground).
Keyboard-navigable. Respect prefers-reduced-motion for the countdown/glow. Mobile-first.

## Out of scope
User accounts / OAuth, payments, color history, any admin dashboard. Ownership is the
secret link only.

---

## Tuning knobs (decide before handoff)
- **Vibe** — default is color-forward, warm/neighborly, playful-but-clean. Alternatives:
  minimal/techy dashboard, or cozy/retro.
- **Screen scope** — no marketing landing page included; add one for a public homepage.
- **Daily-color-themes-the-page** — a strong hook but optional; drop for a stable brand look.
