import { describe, expect, it } from 'vitest';
import { drawableNavigationPolygons } from './polygonIndices';

describe('drawableNavigationPolygons', () => {
  it('keeps every polygon whose indices are in range (happy path)', () => {
    expect(drawableNavigationPolygons([[0, 1, 2], [0, 2, 3]], 4)).toEqual([
      [0, 1, 2],
      [0, 2, 3],
    ]);
  });

  it('drops a polygon with fewer than three indices (Godot skips it)', () => {
    expect(drawableNavigationPolygons([[0, 1], [0, 1, 2], []], 3)).toEqual([[0, 1, 2]]);
  });

  it('drops a polygon indexing a vertex that does not exist (error path)', () => {
    expect(drawableNavigationPolygons([[0, 1, 9], [0, 1, 2]], 3)).toEqual([[0, 1, 2]]);
    expect(drawableNavigationPolygons([[0, 1, -1]], 3)).toEqual([]);
  });

  it('drops everything when there are no vertices to index (edge case)', () => {
    expect(drawableNavigationPolygons([[0, 1, 2]], 0)).toEqual([]);
    expect(drawableNavigationPolygons([], 4)).toEqual([]);
  });
});
