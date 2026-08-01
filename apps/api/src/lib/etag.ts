// HTTP entity-tags for the public read route.
//
// The validator is derived from the response body itself, so anything that can
// change the body — palette, custom colors, name, timezone, rotation hour, the
// rotation itself — moves the ETag. Deriving it from a couple of hand-picked
// inputs is what let a mid-day palette change keep serving 304s against a stale
// body.

// First 16 hex digits (64 bits) of SHA-256 over the body. Truncation is fine
// here: this identifies a representation for cache revalidation, it is not a
// security boundary.
export async function weakEtag(body: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
  let hex = ''
  for (const byte of new Uint8Array(digest, 0, 8)) hex += byte.toString(16).padStart(2, '0')
  return `W/"${hex}"`
}

// RFC 9110 §13.1.2: If-None-Match is `*` or a comma-separated list of entity-tags
// compared with the WEAK comparison function — W/"x" matches both W/"x" and "x".
//
// Splitting on commas is safe for our own tags (hex digits only). A foreign tag
// containing a comma would fragment, but no fragment can equal one of ours.
export function ifNoneMatchSatisfied(header: string | undefined | null, etag: string): boolean {
  if (!header) return false
  if (header.trim() === '*') return true
  const strong = (tag: string) => tag.trim().replace(/^W\//, '')
  const target = strong(etag)
  return header.split(',').some((candidate) => strong(candidate) === target)
}
