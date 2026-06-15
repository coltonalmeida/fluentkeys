// Strength → color gradient (spec §6.2): red→orange→yellow→green→teal. Shared by
// the keyboard keys and the letter-strength panel. Kept out of component files so
// fast refresh stays happy.

const STRENGTH_STOPS: [number, [number, number, number]][] = [
  [0, [176, 70, 70]],
  [40, [184, 124, 64]],
  [65, [170, 158, 74]],
  [85, [95, 142, 95]],
  [100, [72, 150, 140]],
]

export function strengthColor(score: number): string {
  const s = Math.min(100, Math.max(0, score))
  for (let i = 1; i < STRENGTH_STOPS.length; i++) {
    const [hi, hiColor] = STRENGTH_STOPS[i]!
    if (s <= hi) {
      const [lo, loColor] = STRENGTH_STOPS[i - 1]!
      const t = (s - lo) / (hi - lo || 1)
      const c = loColor.map((v, k) => Math.round(v + (hiColor[k]! - v) * t))
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
    }
  }
  return 'rgb(72, 150, 140)'
}
