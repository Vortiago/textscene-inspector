import { describe, expect, it } from 'vitest';
import type { Vector2 } from '../../../godot/math/vector';
import { triangulateContours } from './triangulate';

/** A square wound counter-clockwise on a y-up page. */
function square(x: number, y: number, size: number): Vector2[] {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ];
}

/** A hole winds clockwise. */
const hole = (points: Vector2[]): Vector2[] => points.reverse();

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
    const corners = triangulateContours([lShape]);
    expect([corners.length / 3, totalArea(corners)]).toEqual([4, 300]);
  });

  it('keeps the winding of the outline on every triangle', () => {
    const corners = triangulateContours([square(0, 0, 10)]);
    expect(triangleAreas(corners).every((area) => area > 0)).toBe(true);
  });

  it('fills two separate outlines', () => {
    const corners = triangulateContours([square(0, 0, 10), square(20, 0, 5)]);
    expect(totalArea(corners)).toBe(125);
  });

  it('leaves each of two holes in one outline uncovered', () => {
    const corners = triangulateContours([square(0, 0, 30), hole(square(3, 3, 6)), hole(square(18, 12, 6))]);
    expect(totalArea(corners)).toBeCloseTo(900 - 36 - 36, 9);
  });

  it('fills an island inside a hole, and not the hole', () => {
    const corners = triangulateContours([square(0, 0, 30), hole(square(5, 5, 20)), square(10, 10, 10)]);
    expect(totalArea(corners)).toBeCloseTo(900 - 400 + 100, 9);
  });

  it('gives nothing for a hole that no outline sees', () => {
    expect(triangulateContours([square(0, 0, 10), hole(square(50, 50, 4))])).toEqual([]);
  });

  it('gives nothing for no contour', () => {
    expect(triangulateContours([])).toEqual([]);
  });
});
