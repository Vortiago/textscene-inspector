/** Tests for the ConvexPolygonShape3D decode. */

import { describe, expect, it } from 'vitest';
import { decodeConvexPolygonShape3D } from './decode';

describe('decodeConvexPolygonShape3D', () => {
  it('parses an 8-vertex point cloud (24 floats)', () => {
    const points = decodeConvexPolygonShape3D({
      points: 'PackedVector3Array(0,0,0, 1,0,0, 1,1,0, 0,1,0, 0,0,1, 1,0,1, 1,1,1, 0,1,1)',
    }).points;
    expect(points.length).toBe(24);
    expect(points.length / 3).toBe(8);
  });

  it('yields empty points when the property is absent', () => {
    expect(decodeConvexPolygonShape3D({}).points.length).toBe(0);
  });

  it('degrades to empty points (no throw) on malformed data', () => {
    // CollisionGizmo calls this directly in render with no error boundary, so
    // a hand-edited/corrupt array must not crash the whole scene preview.
    expect(() =>
      decodeConvexPolygonShape3D({ points: 'PackedVector3Array(1, x, 3)' })
    ).not.toThrow();
    expect(decodeConvexPolygonShape3D({ points: 'garbage' }).points.length).toBe(0);
  });
});
