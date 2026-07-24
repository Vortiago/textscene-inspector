/**
 * Utility: convert a `PackedVector2Array` point array + `closed` flag
 * into flat `[ax,ay,0, bx,by,0, ...]` segment positions for <lineSegments>.
 *
 * Closed polygon: N segments (v0→v1, v1→v2, …, vN-1→v0).
 * Open polygon: N-1 segments (v0→v1, …, vN-2→vN-1).
 */

interface Point2D {
  x: number;
  y: number;
}

export function polygonToSegments(points: Point2D[], closed: boolean): Float32Array | null {
  const n = points.length;
  if (n < 2) return null;

  // Godot Y is down; three Y is up → negate.
  const toThree = (p: Point2D): [number, number, number] => [p.x, -p.y, 0];

  // Convert all points first so we can index freely.
  const pts: [number, number, number][] = points.map(toThree);

  const segCount = closed ? n : n - 1;
  const out = new Float32Array(segCount * 2 * 3);

  for (let i = 0; i < segCount; i++) {
    const a = pts[i]!;
    let b: [number, number, number];
    if (closed) {
      b = pts[(i + 1) % n]!;
    } else {
      b = pts[i + 1]!;
    }
    const offset = i * 6;
    out[offset] = a[0]; out[offset + 1] = a[1]; out[offset + 2] = a[2];
    out[offset + 3] = b[0]; out[offset + 4] = b[1]; out[offset + 5] = b[2];
  }

  return out;
}
