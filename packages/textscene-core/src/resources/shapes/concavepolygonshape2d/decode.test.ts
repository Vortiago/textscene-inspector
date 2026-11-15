/** ConcavePolygonShape2D decode: `segments` as authored, empty when absent or malformed. */

import { describe, expect, it } from 'vitest';
import { decodeConcavePolygonShape2D } from './decode';

describe('decodeConcavePolygonShape2D', () => {
  it('reads the end points of each segment in the order authored', () => {
    expect(
      decodeConcavePolygonShape2D({ segments: 'PackedVector2Array(0, 0, 10, 0, 10, 0, 5, 8)' }).segments
    ).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 8 },
    ]);
  });

  it('is empty when absent', () => {
    expect(decodeConcavePolygonShape2D({}).segments).toEqual([]);
  });

  it('is empty for a malformed array, so the shape draws nothing', () => {
    expect(decodeConcavePolygonShape2D({ segments: 'nonsense' }).segments).toEqual([]);
  });
});
