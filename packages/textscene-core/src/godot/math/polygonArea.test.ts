import { describe, expect, it } from 'vitest';
import { signedPolygonArea } from './polygonArea';

const SQUARE = [
  { x: 0, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 2 },
  { x: 0, y: 2 },
];

describe('signedPolygonArea', () => {
  it('is positive for a counter-clockwise ring, y up', () => {
    expect(signedPolygonArea(SQUARE)).toBe(4);
  });

  it('is negative for a clockwise ring', () => {
    expect(signedPolygonArea([...SQUARE].reverse())).toBe(-4);
  });

  it('is zero for a polygon with no points (edge case)', () => {
    expect(signedPolygonArea([])).toBe(0);
  });
});
