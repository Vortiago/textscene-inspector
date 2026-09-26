/** The cubic Bézier both Bézier curve resources tessellate their spans with. No THREE. */

/** One component of the cubic Bézier through `a`, `b`, `c` and `d`, at `t` in [0, 1]. */
export function cubicBezier(a: number, b: number, c: number, d: number, t: number): number {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}
