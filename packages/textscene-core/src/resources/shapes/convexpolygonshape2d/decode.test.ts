/** ConvexPolygonShape2D decode: `points` as authored, empty when absent or malformed. */

import { describe, expect, it } from 'vitest';
import { decodeConvexPolygonShape2D } from './decode';

describe('decodeConvexPolygonShape2D', () => {
  it('reads the points in the order authored', () => {
    expect(decodeConvexPolygonShape2D({ points: 'PackedVector2Array(0, 0, 10, 0, 5, 8)' }).points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 8 },
    ]);
  });

  it('is empty when absent', () => {
    expect(decodeConvexPolygonShape2D({}).points).toEqual([]);
  });

  it('is empty for a malformed array, so the shape draws nothing', () => {
    expect(decodeConvexPolygonShape2D({ points: 'PackedVector2Array(1, x)' }).points).toEqual([]);
  });
});
