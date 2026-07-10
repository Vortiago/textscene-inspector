/**
 * Unit coverage for `capsulePoints`' arc math — a rendered `<lineSegments>`
 * buffer doesn't expose the point sequence, so this asserts directly on the
 * geometry a `CapsuleShape2D` collision gizmo traces.
 *
 * Regression for a self-intersecting outline: the top cap previously swept
 * -90°..90° (the RIGHT semicircle of the top-cap circle, bottom → right →
 * top) instead of 0°..180° (the TOP semicircle, right → top → left), and the
 * bottom cap swept the LEFT semicircle instead of the BOTTOM one. The bug
 * produced a polyline that jumped from the right side's top point down
 * toward the cap circle's waist, retraced back through that same point, then
 * chorded straight across to the left side's top point — skipping the
 * top-left and bottom-right quarter arcs entirely.
 */
import { describe, expect, it } from 'vitest';
import { capsulePoints } from './CollisionGizmo2D';

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('capsulePoints', () => {
  it('traces a continuous contour with no chord jumps (happy path)', () => {
    const radius = 10;
    const height = 30; // halfHeight = 5, so the two straight sides are length 10
    const points = capsulePoints(radius, height);

    // Every edge is either a small uniform arc step (chord = 2·r·sin(π/32) ≈
    // 1.96, for CAPSULE_CAP_SEGMENTS=16) or one of the two straight sides
    // (length 2·halfHeight = 10). A self-intersecting chord cutting through
    // the capsule interior (the original bug) produces a THIRD, much larger
    // distance that is neither — so the sorted edge lengths must fall into
    // exactly two clusters, with only the two straight sides in the upper one.
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

    // The topmost point of the whole contour must be the apex of the TOP
    // cap circle — (0, halfHeight + radius) — not a point on its right or
    // left flank; likewise the bottommost point must be the BOTTOM cap's
    // apex, not its left or right flank. The old (buggy) parameterization
    // never actually visited either apex.
    const top = points.reduce((a, b) => (b.y > a.y ? b : a));
    const bottom = points.reduce((a, b) => (b.y < a.y ? b : a));
    expect(top.x).toBeCloseTo(0, 5);
    expect(top.y).toBeCloseTo(5 + radius, 5);
    expect(bottom.x).toBeCloseTo(0, 5);
    expect(bottom.y).toBeCloseTo(-(5 + radius), 5);
  });

  it('produces no duplicate/retraced points (edge case — the bug revisited the right-side connection point)', () => {
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
    // two caps meet directly — still must be a valid, continuous contour.
    const points = capsulePoints(10, 5);
    expect(points.length).toBeGreaterThan(0);
    for (let i = 0; i < points.length; i++) {
      const next = points[(i + 1) % points.length]!;
      expect(dist(points[i]!, next)).toBeLessThan(10 * 0.6);
    }
  });
});
