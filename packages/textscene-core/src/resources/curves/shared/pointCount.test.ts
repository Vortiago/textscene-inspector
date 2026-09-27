import { describe, expect, it } from 'vitest';
import { MAX_PADDED_POINTS, resizeBezierPoints } from './pointCount';

const newPoint = () => 0;

describe('resizeBezierPoints', () => {
  it('drops the tail at a smaller count and appends new points at a larger one', () => {
    expect(resizeBezierPoints([1, 2, 3], 2, newPoint)).toEqual([1, 2]);
    expect(resizeBezierPoints([1, 2], 4, newPoint)).toEqual([1, 2, 0, 0]);
  });

  it('returns the same list at an equal count and at a negative one', () => {
    const points = [1, 2];
    expect(resizeBezierPoints(points, 2, newPoint)).toBe(points);
    expect(resizeBezierPoints(points, -1, newPoint)).toBe(points);
  });

  it('never grows the list past MAX_PADDED_POINTS (edge case)', () => {
    expect(resizeBezierPoints([], MAX_PADDED_POINTS + 1, newPoint)).toHaveLength(MAX_PADDED_POINTS);
  });

  it('never mutates the caller list (edge case)', () => {
    const points = [1, 2, 3];
    resizeBezierPoints(points, 1, newPoint);
    resizeBezierPoints(points, 5, newPoint);
    expect(points).toEqual([1, 2, 3]);
  });
});
