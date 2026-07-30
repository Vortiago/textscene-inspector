/**
 * Polygon2D's `polygons` index lists and `invert_enabled`.
 *
 * `polygon_2d.cpp` NOTIFICATION_DRAW:
 *
 *   if (invert || polygons.is_empty()) triangulate(points)
 *   else  for each entry in `polygons`: triangulate points[src_indices[j]]
 *
 * so a non-empty `polygons` means Godot does NOT use the stored vertex order —
 * it builds one sub-polygon per index list. We always stroked `polygon` in
 * order, which for a multi-part shape draws a garbled blob rather than the
 * parts. The same block also drops the last `internal_vertex_count` vertices
 * ONLY when `polygons` is empty (or invert is on), because internal vertices
 * are UV/skinning helpers that are not part of the outline.
 *
 * `invert_enabled` (default false) fills the polygon's AABB grown by
 * `invert_border` (default 100) with the polygon punched out as a hole —
 * the photographic negative of what we drew.
 */
import { describe, expect, it } from 'vitest';
import { polygonRings } from './polygonShapes';

/** A 10x10 square followed by a second, disjoint 10x10 square. */
const TWO_SQUARES = new Float32Array([
  0, 0, 10, 0, 10, 10, 0, 10, 20, 0, 30, 0, 30, 10, 20, 10,
]);

describe('polygonRings', () => {
  it('uses the stored vertex order when `polygons` is empty', () => {
    const rings = polygonRings(TWO_SQUARES, [], 0, false, 100);
    expect(rings.outlines).toHaveLength(1);
    expect(rings.outlines[0]).toHaveLength(8);
    expect(rings.hole).toBeNull();
  });

  it('builds one ring per `polygons` entry, indexing into `polygon`', () => {
    const rings = polygonRings(TWO_SQUARES, [[0, 1, 2, 3], [4, 5, 6, 7]], 0, false, 100);
    expect(rings.outlines).toHaveLength(2);
    // Rings are INDICES into the shared vertex pool, so a caller can carry
    // `uv` / `vertex_colors` through unchanged.
    expect(rings.outlines[0]).toEqual([0, 1, 2, 3]);
    expect(rings.outlines[1]).toEqual([4, 5, 6, 7]);
    expect(rings.points[0]).toEqual({ x: 0, y: 0 });
    expect(rings.points[4]).toEqual({ x: 20, y: 0 });
  });

  it('skips a degenerate `polygons` entry of fewer than three indices', () => {
    expect(polygonRings(TWO_SQUARES, [[0, 1]], 0, false, 100).outlines).toHaveLength(0);
  });

  it('drops internal vertices only when `polygons` is empty', () => {
    // Last two vertices are internal → the outline is the first square alone.
    expect(polygonRings(TWO_SQUARES, [], 4, false, 100).outlines[0]).toHaveLength(4);
    // With `polygons` present, Godot keeps them — the index lists decide.
    expect(polygonRings(TWO_SQUARES, [[0, 1, 2, 3]], 4, false, 100).outlines[0]).toHaveLength(4);
  });

  it('inverts into a grown AABB with the polygon as a hole', () => {
    const rings = polygonRings(TWO_SQUARES.slice(0, 8), [], 0, true, 5);
    // Border rect = AABB (0,0)-(10,10) grown by 5 on every side. Its corners are
    // new vertices, appended after the polygon's own so they index cleanly.
    expect(rings.outlines).toHaveLength(1);
    expect(rings.outlines[0]).toEqual([4, 5, 6, 7]);
    expect(rings.outlines[0]!.map((i) => rings.points[i])).toEqual([
      { x: -5, y: -5 },
      { x: 15, y: -5 },
      { x: 15, y: 15 },
      { x: -5, y: 15 },
    ]);
    expect(rings.hole).toEqual([0, 1, 2, 3]);
    expect(rings.hole!.map((i) => rings.points[i])).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
  });

  it('trims internal vertices when inverted — Godot trims on that branch too', () => {
    // `if ((invert || polygons.is_empty()) && internal_vertices > 0) len -= internal_vertices;`
    // — the trim is NOT skipped by invert, so the punched-out hole is the
    // outline alone and the grown bounds are measured from it.
    const rings = polygonRings(TWO_SQUARES, [], 4, true, 5);
    expect(rings.hole).toEqual([0, 1, 2, 3]);
    expect(rings.hole!.map((i) => rings.points[i])).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
    // Bounds grown from the FIRST square only; the trimmed second square
    // (x up to 30) must not widen them.
    expect(rings.outlines[0]!.map((i) => rings.points[i])).toEqual([
      { x: -5, y: -5 },
      { x: 15, y: -5 },
      { x: 15, y: 15 },
      { x: -5, y: 15 },
    ]);
  });

  it('ignores `polygons` entirely when inverted, as Godot does', () => {
    const rings = polygonRings(TWO_SQUARES, [[4, 5, 6, 7]], 0, true, 5);
    expect(rings.hole).toHaveLength(8);
  });

  it('returns nothing for a degenerate outline', () => {
    expect(polygonRings(new Float32Array([0, 0, 1, 1]), [], 0, false, 100).outlines).toHaveLength(0);
  });
});
