import { describe, expect, it } from 'vitest';
import type { Vector2 } from '../../../godot/math/vector';
import { triangulateContours, type TriangulatedContour } from './triangulate';

function square(x: number, y: number, size: number): Vector2[] {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ];
}

const outer = (points: Vector2[]): TriangulatedContour => ({ points, isHole: false });
const hole = (points: Vector2[]): TriangulatedContour => ({ points: points.reverse(), isHole: true });

function triangleAreas(corners: readonly Vector2[]): number[] {
  const areas: number[] = [];
  for (let i = 0; i < corners.length; i += 3) {
    const [a, b, c] = corners.slice(i, i + 3) as [Vector2, Vector2, Vector2];
    areas.push(((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2);
  }
  return areas;
}

const totalArea = (corners: readonly Vector2[]) =>
  triangleAreas(corners).reduce((sum, area) => sum + area, 0);

describe('triangulateContours', () => {
  it('fills a concave outline exactly', () => {
    const lShape: Vector2[] = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 20 },
      { x: 0, y: 20 },
    ];
    const corners = triangulateContours([outer(lShape)]);
    expect([corners.length / 3, totalArea(corners)]).toEqual([4, 300]);
  });

  it('winds every triangle with a positive signed area', () => {
    const corners = triangulateContours([outer(square(0, 0, 10).reverse())]);
    expect(triangleAreas(corners).every((area) => area > 0)).toBe(true);
  });

  it('fills two separate outlines', () => {
    const corners = triangulateContours([outer(square(0, 0, 10)), outer(square(20, 0, 5))]);
    expect(totalArea(corners)).toBe(125);
  });

  it('leaves each of two holes in one outline uncovered', () => {
    const corners = triangulateContours([
      outer(square(0, 0, 30)),
      hole(square(3, 3, 6)),
      hole(square(18, 12, 6)),
    ]);
    expect(totalArea(corners)).toBeCloseTo(900 - 36 - 36, 9);
  });

  it('fills an island inside a hole, and not the hole', () => {
    const corners = triangulateContours([
      outer(square(0, 0, 30)),
      hole(square(5, 5, 20)),
      outer(square(10, 10, 10)),
    ]);
    expect(totalArea(corners)).toBeCloseTo(900 - 400 + 100, 9);
  });

  it('leaves a hole uncovered however the outline winds', () => {
    const corners = triangulateContours([outer(square(0, 0, 10).reverse()), hole(square(3, 3, 4).reverse())]);
    expect(totalArea(corners)).toBeCloseTo(84, 9);
  });

  it('ignores a hole that no outline contains', () => {
    const corners = triangulateContours([outer(square(0, 0, 10)), hole(square(50, 50, 4))]);
    expect(totalArea(corners)).toBe(100);
  });

  it('gives nothing for no contour', () => {
    expect(triangulateContours([])).toEqual([]);
  });
});
