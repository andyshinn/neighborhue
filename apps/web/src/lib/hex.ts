// 6-digit #RRGGBB only — matches the API's HEX_RE (/^#[0-9A-Fa-f]{6}$/) and its
// hexToRgb, which assumes 6 digits. The handoff's 3-digit "#F60" shorthand is
// rejected here for client↔API parity (spec M9).
const HEX_RE = /^#[0-9A-Fa-f]{6}$/

export function validateHex(hex: string): boolean {
  return HEX_RE.test(hex)
}
