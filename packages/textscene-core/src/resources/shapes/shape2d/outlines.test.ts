/**
 * The point loops the 2D shapes draw, as Godot builds them: `RectangleShape2D::draw`
 * (`rectangle_shape_2d.cpp:77-83`), `CircleShape2D::draw` (`circle_shape_2d.cpp:77-83`) and
 * `CapsuleShape2D::_get_points` (`capsule_shape_2d.cpp:30-43`). Y grows downwards.
 */
import { describe, expect, it } from 'vitest';
import { capsulePoints, circlePoints, rectanglePoints } from './outlines';

describe('rectanglePoints', () => {
  it('centres the corners on the origin, clockwise on screen from the top-left', () => {
    expect(rectanglePoints({ x: 40, y: 20 })).toEqual([
      { x: -20, y: -10 },
      { x: 20, y: -10 },
      { x: 20, y: 10 },
      { x: -20, y: 10 },
    ]);
  });

  it('collapses a zero size to the origin (edge case)', () => {
    expect(rectanglePoints({ x: 0, y: 0 }).every((p) => p.x === 0 && p.y === 0)).toBe(true);
  });
});

describe('circlePoints', () => {
  it('has 24 points, the first on +X and the seventh on +Y', () => {
    const points = circlePoints(5);

    expect(points).toHaveLength(24);
    expect(points[0]).toEqual({ x: 5, y: 0 });
    expect(points[6]!.x).toBeCloseTo(0, 9);
    expect(points[6]!.y).toBeCloseTo(5, 9);
  });

  it('places every point at the radius', () => {
    for (const p of circlePoints(7)) expect(Math.hypot(p.x, p.y)).toBeCloseTo(7, 9);
  });

  it('collapses a zero radius to the origin (edge case)', () => {
    expect(circlePoints(0).every((p) => p.x === 0 && p.y === 0)).toBe(true);
  });
});

describe('capsulePoints', () => {
  const points = capsulePoints(10, 40);

  it('has 26 points: 24 around the turn and one more at each side where the arc changes centre', () => {
    expect(points).toHaveLength(26);
  });

  it('starts at the bottom of the lower cap, 20 below the centre', () => {
    expect(points[0]!.x).toBeCloseTo(0, 9);
    expect(points[0]!.y).toBeCloseTo(20, 9);
  });

  it('runs the right side up from (10, 10) to (10, -10)', () => {
    expect(points[6]!.x).toBeCloseTo(10, 9);
    expect(points[6]!.y).toBeCloseTo(10, 9);
    expect(points[7]!.x).toBeCloseTo(10, 9);
    expect(points[7]!.y).toBeCloseTo(-10, 9);
  });

  it('runs the left side down from (-10, -10) to (-10, 10)', () => {
    expect(points[19]!.x).toBeCloseTo(-10, 9);
    expect(points[19]!.y).toBeCloseTo(-10, 9);
    expect(points[20]!.x).toBeCloseTo(-10, 9);
    expect(points[20]!.y).toBeCloseTo(10, 9);
  });

  it('repeats the side point when the height is twice the radius, a circle (edge case)', () => {
    const circle = capsulePoints(10, 20);

    expect(circle[7]!.x).toBeCloseTo(circle[6]!.x, 9);
    expect(circle[7]!.y).toBeCloseTo(circle[6]!.y, 9);
  });
});
