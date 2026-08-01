# Read-path cache validators — 2026-08-01

Design record for `GET /v1/neighborhoods/:id`: what the `ETag` covers and how long
a response may be reused without revalidating.

## The bug

The ETag was `"<id>-<day_index>"`. It covered the clock and nothing else.

`palette` and `custom_colors` are also inputs to the rendered color. An admin who
PATCHed the palette changed `color.hex` while `day_index` stayed put, so the
validator did not move. A conditional client sent `If-None-Match`, got a `304`,
and kept serving the old color until the next rotation.

`Cache-Control: public, max-age=<seconds_until_rotation>` made that worse for
shared caches, and independently of the ETag: a cache never revalidates a
response that is still fresh, so a correct ETag alone cannot help. A CDN could
hold the pre-change body for up to a day.

## Decisions

### D1 — Derive the validator from the response body

Build the body, hash it, use the first 16 hex digits (64 bits) of SHA-256.
Truncation is fine: this identifies a representation for revalidation, it is not
a security boundary.

Hashing the body rather than a hand-picked list of inputs is the point. A list
has to be maintained in step with the response shape, and the bug above is
exactly what happens when it isn't. Anything that can change the body — color,
palette, custom colors, name, timezone, rotation hour, the rotation itself — is
hash input by construction.

### D2 — Exclude `seconds_until_rotation`, and be weak about it

`seconds_until_rotation` is in the body and changes every second. Hashing it
verbatim would mint a fresh ETag on every request: `If-None-Match` would never
match, every poll would get a full `200`, and conditional requests would be worse
than useless. It is normalized out of the hash input.

That exclusion means two responses sharing an ETag are semantically equivalent
but not byte-identical, which is the definition of a **weak** validator, so the
header is `W/"..."`. Marking it strong would be a lie about an observable field.

Consumers that need a live countdown must derive it from the absolute
`next_rotation_at` — which *is* covered by the hash — not from the relative
`seconds_until_rotation`. `apps/web` already does this (share-page spec S6).

### D3 — One validator per representation

`?format=hex` and `?format=rgb` hash the exact bytes they return; the JSON
representation hashes its own body. The formats are distinct URLs, so distinct
validators are correct, and it gives a better answer: renaming a neighborhood
moves the JSON validator and correctly leaves the `hex` one alone.

### D4 — Compare `If-None-Match` properly

RFC 9110 §13.1.2: the header is `*` or a comma-separated list, compared with the
weak comparison function. The old code did a single exact string match. It now
accepts a list, `*`, and a tag that lost its `W/` prefix in transit.

### D5 — Short freshness, not a day-long one

`public, max-age=60, stale-while-revalidate=60`.

Rejected alternatives:

- **`must-revalidate` added to the day-long `max-age`.** This does not fix the
  problem. `must-revalidate` constrains what a cache may do once a response is
  *already stale*; it says nothing about the freshness window itself. With
  `max-age=86400` a shared cache still serves the pre-change body for a day
  without asking. Rejected as ineffective, not as a tradeoff. It would also be
  actively counterproductive here: with Origin Cache Control enabled, Cloudflare
  treats `must-revalidate`/`proxy-revalidate`/`s-maxage` as directives that
  *prevent* serving stale content, so it would disable the
  `stale-while-revalidate` behavior we do want.
- **Accept up to a day of propagation delay.** Rejected: an admin who changes the
  palette expects to see it, and "your edit may take a day" is a bad contract for
  a feature whose whole job is displaying the right color.
- **`no-cache`.** Correct, and tempting given how cheap a `304` is. Rejected only
  because a 60-second window still collapses polling bursts at the edge at a cost
  of at most a minute's propagation delay.

Both directives are clamped so `max-age + stale-while-revalidate` never exceeds
`seconds_until_rotation` — that sum is the longest a shared cache may go without
reaching the origin, and past a rotation it would be serving yesterday's color.
Near a rotation both shrink to zero, forcing revalidation exactly at the boundary.

Worst case for an admin edit reaching a shared cache is therefore about two
minutes. Origin load rises from roughly one request per neighborhood per day per
PoP to one per minute, which D1 is comfortable with.

Cloudflare honors `stale-while-revalidate`, and since [February 2026](https://developers.cloudflare.com/changelog/post/2026-02-26-async-stale-while-revalidate/)
revalidates asynchronously — the first request past `max-age` gets the stale body
with an `UPDATING` status while the refresh happens in the background. An
intermediary that ignores the directive entirely just revalidates at `max-age`
instead, which fails safe: more origin hits, never a staler body.

This weakens the rationale in the frontend-foundation spec W8 ("a public fetch
hits the edge cache the API already populates"). The edge cache still absorbs
bursts, just over a 60-second window rather than a day. W8's conclusion — public
fetch over a service binding — stands.

## Code

| File | Role |
|---|---|
| `apps/api/src/lib/etag.ts` | `weakEtag(body)`, `ifNoneMatchSatisfied(header, etag)` |
| `apps/api/src/lib/cache.ts` | `cacheControlFor(secondsUntilRotation)` + the two policy constants |
| `apps/api/src/routes/neighborhoods.ts` | builds the body, then derives the validator from it |

## Tests

`test/etag.test.ts` and `test/cache.test.ts` cover the two units, including the
SHA-256 digest against a known vector, weak comparison, lists, `*`, and the
clamping near a rotation.

`test/api.read.test.ts` covers the route:

- the ETag equals the hash of the response body with `seconds_until_rotation`
  normalized out — pinning the construction, so every other field is provably
  hash input;
- PATCHing `palette` changes the ETag while `day_index` holds, and the old
  validator stops buying a `304`;
- PATCHing `custom_colors` changes the ETag with `palette` and `day_index`
  unchanged — custom colors appear nowhere in the public body except through
  `color`, so this is the *rendered color* moving the validator;
- the ETag holds steady while the countdown ticks, so background polls keep
  getting `304`s;
- the `304` repeats the same `ETag` and `Cache-Control`;
- `max-age + stale-while-revalidate` never exceeds `seconds_until_rotation`.
