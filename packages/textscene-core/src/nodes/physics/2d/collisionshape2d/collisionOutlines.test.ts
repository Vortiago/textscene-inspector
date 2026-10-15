/**
 * The outline loops on plain points. The capsule's top cap sweeps 0°..180° (right, top, left) and
 * its bottom cap the bottom semicircle, so the outline never self-intersects.
 */
import { describe, expect, it } from 'vitest';
import { capsulePoints, circlePoints, rectanglePoints } from './collisionOutlines';

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
  it('places every point at the radius, starting on +X', () => {
    const points = circlePoints(5);
    expect(points[0]).toEqual({ x: 5, y: 0 });
    for (const p of points) expect(Math.hypot(p.x, p.y)).toBeCloseTo(5, 9);
  });

  it('leaves the closing point implicit, so the loop has no duplicate of the start (edge case)', () => {
    const points = circlePoints(5);
    const last = points[points.length - 1]!;
    expect(Math.hypot(last.x - 5, last.y)).toBeGreaterThan(0.5);
  });
});

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('capsulePoints', () => {
  it('traces a continuous contour with no chord jumps (happy path)', () => {
    const radius = 10;
    const height = 30; // halfHeight = 5, so the two straight sides are length 10
    const points = capsulePoints(radius, height);

    // Every edge is either an arc step (chord = 2·r·sin(π/32) ≈ 1.96, for
    // CAPSULE_CAP_SEGMENTS=16) or a straight side (2·halfHeight = 10). A chord through the
    // interior is a third, larger length, so the sorted lengths form exactly two clusters,
    // with only the two straight sides in the upper one.
    const edges = points.map((p, i) => dist(p, points[(i + 1) % points.length]!));
    const sorted = [...edges].sort((a, b) => a - b);
    const arcSteps = sorted.slice(0, -2);
    const straightSides = sorted.slice(-2);
    for (const step of arcSteps) {
      expect(step).toBeLessThan(radius * 0.3);
    }
    for (const side of straightSides) {
      expect(side).toBeCloseTo(2 * (height / 2 - radius), 5);
    }
  });

  it('sweeps the top cap over the top (not the right half) and the bottom cap under the bottom (not the left half) (edge case)', () => {
    const radius = 10;
    const height = 30; // halfHeight = height/2 - radius = 5
    const points = capsulePoints(radius, height);

    // The topmost point is the top cap's apex, (0, halfHeight + radius), and the bottommost
    // is the bottom cap's apex, not a point on either flank.
    const top = points.reduce((a, b) => (b.y > a.y ? b : a));
    const bottom = points.reduce((a, b) => (b.y < a.y ? b : a));
    expect(top.x).toBeCloseTo(0, 5);
    expect(top.y).toBeCloseTo(5 + radius, 5);
    expect(bottom.x).toBeCloseTo(0, 5);
    expect(bottom.y).toBeCloseTo(-(5 + radius), 5);
  });

  it('visits each point once, including the right-side connection point (edge case)', () => {
    const points = capsulePoints(10, 30);
    const seen = new Set<string>();
    for (const p of points) {
      const key = `${p.x.toFixed(6)},${p.y.toFixed(6)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('degenerates to a lens (halfHeight clamped to 0) without throwing (edge case)', () => {
    // height < 2*radius: Godot clamps the straight-side length to 0, so the
    // two caps meet directly and the contour stays continuous.
    const points = capsulePoints(10, 5);
    expect(points.length).toBeGreaterThan(0);
    for (let i = 0; i < points.length; i++) {
      const next = points[(i + 1) % points.length]!;
      expect(dist(points[i]!, next)).toBeLessThan(10 * 0.6);
    }
  });
});
