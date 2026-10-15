/**
 * The capsule arc math, asserted on the point sequence a `CapsuleShape2D` gizmo traces, read
 * back from its `<lineSegments>` position buffer. The top cap sweeps 0°..180° (right, top,
 * left) and the bottom cap the bottom semicircle, so the outline never self-intersects.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { CollisionGizmo2D } from './CollisionGizmo2D';
import type { Vector2 } from '../../../../godot/math/vector';

/**
 * The outline a `CapsuleShape2D` gizmo draws, in Godot-local coordinates: the start of each
 * segment, with the three-local Y negation undone.
 */
async function capsulePoints(radius: number, height: number): Promise<Vector2[]> {
  const shape = {
    id: 'CapsuleShape2D_1',
    type: 'CapsuleShape2D',
    data: { radius: String(radius), height: String(height) },
  };
  const renderer = await ReactThreeTestRenderer.create(
    <CollisionGizmo2D shape={shape} color={new THREE.Color()} />
  );
  const [lines] = renderer.scene.findAll((n) => n.type === 'LineSegments');
  const position = (lines!.instance as THREE.LineSegments).geometry.getAttribute('position');
  const points: Vector2[] = [];
  for (let i = 0; i < position.count; i += 2) {
    points.push({ x: position.getX(i), y: -position.getY(i) });
  }
  return points;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('CollisionGizmo2D capsule outline', () => {
  it('traces a continuous contour with no chord jumps (happy path)', async () => {
    const radius = 10;
    const height = 30; // halfHeight = 5, so the two straight sides are length 10
    const points = await capsulePoints(radius, height);

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

  it('sweeps the top cap over the top (not the right half) and the bottom cap under the bottom (not the left half) (edge case)', async () => {
    const radius = 10;
    const height = 30; // halfHeight = height/2 - radius = 5
    const points = await capsulePoints(radius, height);

    // The topmost point is the top cap's apex, (0, halfHeight + radius), and the bottommost
    // is the bottom cap's apex, not a point on either flank.
    const top = points.reduce((a, b) => (b.y > a.y ? b : a));
    const bottom = points.reduce((a, b) => (b.y < a.y ? b : a));
    expect(top.x).toBeCloseTo(0, 5);
    expect(top.y).toBeCloseTo(5 + radius, 5);
    expect(bottom.x).toBeCloseTo(0, 5);
    expect(bottom.y).toBeCloseTo(-(5 + radius), 5);
  });

  it('produces no duplicate/retraced points (edge case — the bug revisited the right-side connection point)', async () => {
    const points = await capsulePoints(10, 30);
    const seen = new Set<string>();
    for (const p of points) {
      const key = `${p.x.toFixed(6)},${p.y.toFixed(6)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('degenerates to a lens (halfHeight clamped to 0) without throwing (edge case)', async () => {
    // height < 2*radius: Godot clamps the straight-side length to 0, so the
    // two caps meet directly and the contour stays continuous.
    const points = await capsulePoints(10, 5);
    expect(points.length).toBeGreaterThan(0);
    for (let i = 0; i < points.length; i++) {
      const next = points[(i + 1) % points.length]!;
      expect(dist(points[i]!, next)).toBeLessThan(10 * 0.6);
    }
  });
});
