import { mulberry32, strHash } from './hash'

// Deterministic, evenly-distributed selection from an ordered color list.
// Each cycle of n days is a fresh seeded Fisher-Yates permutation of [0..n),
// so within a cycle every color appears exactly once.
//
// TODO(v1): the only possible adjacent repeat is at a cycle boundary (last of
// one cycle == first of the next). Acceptable for v1; to eliminate, reshuffle
// the next cycle until order[0] !== previousCycleLast.
export function pickColorIndex(neighborhoodId: string, dayIndex: number, n: number): number {
  if (n <= 0) throw new Error('empty color list')
  if (n === 1) return 0
  const cycle = Math.floor(dayIndex / n)
  const pos = ((dayIndex % n) + n) % n
  const rnd = mulberry32(strHash(`${neighborhoodId}:${cycle}`))
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order[pos]
}
