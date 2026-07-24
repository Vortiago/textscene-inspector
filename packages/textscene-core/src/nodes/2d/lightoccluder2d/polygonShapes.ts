/**
 * Utility: convert a flat `PackedVector2Array` `[x0,y0, x1,y1, …]` + `closed`
 * flag into flat `[ax,ay,0, bx,by,0, …]` segment positions for <lineSegments>.
 *
 * Closed polygon: N segments (v0→v1, v1→v2, …, vN-1→v0).
 * Open polygon: N-1 segments (v0→v1, …, vN-2→vN-1).
 *
 * A dangling odd trailing coordinate is ignored (whole points only, via
 * `floor(length / 2)`) rather than read past the end as a NaN. Returns null
 * for fewer than 2 whole points.
 */
export function polygonToSegments(points: ArrayLike<number>, closed: boolean): Float32Array | null {
  const n = Math.floor(points.length / 2);
  if (n < 2) return null;

  const segCount = closed ? n : n - 1;
  const out = new Float32Array(segCount * 2 * 3);

  for (let i = 0; i < segCount; i++) {
    // For the open case (segCount = n-1) i+1 is always < n, so the modulo
    // yields i+1 — one expression covers both closed wrap and open chain.
    const j = (i + 1) % n;
    const o = i * 6;
    // Godot Y is down; three Y is up → negate. `0 - v` (not `-v`) keeps a zero
    // input at +0, matching the repo's node2dTransform / navigationOverlay idiom.
    out[o] = points[i * 2]!;
    out[o + 1] = 0 - points[i * 2 + 1]!;
    out[o + 2] = 0;
    out[o + 3] = points[j * 2]!;
    out[o + 4] = 0 - points[j * 2 + 1]!;
    out[o + 5] = 0;
  }

  return out;
}
