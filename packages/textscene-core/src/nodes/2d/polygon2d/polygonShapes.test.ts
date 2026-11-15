/**
 * Tests Polygon2D's `polygons` index lists and `invert_enabled`. In
 * `polygon_2d.cpp` NOTIFICATION_DRAW a non-empty `polygons` builds one
 * sub-polygon per index list, and `invert_enabled` (default false) bridges the
 * polygon to its bounds grown by `invert_border` (default 100), in one ring.
 */
import { describe, expect, it } from 'vitest';
import { polygonRings } from './polygonShapes';

/** A 10x10 square followed by a second, disjoint 10x10 square. */
const TWO_SQUARES = new Float32Array([0, 0, 10, 0, 10, 10, 0, 10, 20, 0, 30, 0, 30, 10, 20, 10]);

describe('polygonRings', () => {
  it('uses the stored vertex order when `polygons` is empty', () => {
    const rings = polygonRings(TWO_SQUARES, [], 0, false, 100);
    expect(rings.outlines).toHaveLength(1);
    expect(rings.outlines[0]).toHaveLength(8);
  });

  it('builds one ring per `polygons` entry, indexing into `polygon`', () => {
    const rings = polygonRings(
      TWO_SQUARES,
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
      ],
      0,
      false,
      100
    );
    expect(rings.outlines).toHaveLength(2);
    // Rings are indices into the shared vertex pool, so a caller can carry
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
    // With `polygons` present, Godot keeps them: the index lists decide.
    expect(polygonRings(TWO_SQUARES, [[0, 1, 2, 3]], 4, false, 100).outlines[0]).toHaveLength(4);
  });

  it('bridges the polygon to its grown bounds after its lowest vertex', () => {
    const rings = polygonRings(TWO_SQUARES.slice(0, 8), [], 0, true, 5);
    const bridgeX = Math.fround(10 - 0.00001);
    expect(rings.outlines).toEqual([rings.points.map((_, i) => i)]);
    expect(rings.points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 10, y: 15 },
      { x: 15, y: 15 },
      { x: 15, y: -5 },
      { x: -5, y: -5 },
      { x: -5, y: 15 },
      { x: bridgeX, y: 15 },
      { x: bridgeX, y: 10 },
      { x: 0, y: 10 },
    ]);
  });

  it('mirrors the bridge for a polygon wound the other way', () => {
    const rings = polygonRings(new Float32Array([0, 0, 0, 10, 10, 10, 10, 0]), [], 0, true, 5);
    const bridgeX = Math.fround(0 - 0.00001);
    expect(rings.points).toEqual([
      { x: 0, y: 0 },
      { x: bridgeX, y: 10 },
      { x: bridgeX, y: 15 },
      { x: -5, y: 15 },
      { x: -5, y: -5 },
      { x: 15, y: -5 },
      { x: 15, y: 15 },
      { x: 0, y: 15 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
    ]);
  });

  it('measures the inverted bounds after it trims the internal vertices', () => {
    // `if ((invert || polygons.is_empty()) && internal_vertices > 0) len -= internal_vertices;`
    const rings = polygonRings(TWO_SQUARES, [], 4, true, 5);
    expect(rings.points).toHaveLength(11);
    expect(Math.max(...rings.points.map((point) => point.x))).toBe(15);
  });

  it('ignores `polygons` entirely when inverted, as Godot does', () => {
    const rings = polygonRings(TWO_SQUARES, [[4, 5, 6, 7]], 0, true, 5);
    expect(rings.outlines).toHaveLength(1);
    expect(rings.points).toHaveLength(15);
  });

  it('still inverts a ring the trim leaves under three points', () => {
    // Only `len <= 0` returns (`polygon_2d.cpp:158-160`).
    const rings = polygonRings(TWO_SQUARES.slice(0, 6), [], 2, true, 5);
    expect(rings.points).toHaveLength(8);
  });

  it('returns nothing for a degenerate outline', () => {
    expect(polygonRings(new Float32Array([0, 0, 1, 1]), [], 0, false, 100).outlines).toHaveLength(0);
  });
});
