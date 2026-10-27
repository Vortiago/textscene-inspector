/**
 * The lines of the Decal gizmo (`decal_gizmo_plugin.cpp:92-128`). The expected vertices come from a
 * GDScript port of `redraw` that ran in Godot 4.6.3, through the engine's own `AABB` and `Vector3`.
 */
import { describe, expect, it } from 'vitest';
import { decalGizmoLines } from './gizmoLines';

const v = (x: number, y = x, z = x) => ({ x, y, z });

/** The segments of `lines`, each as its six numbers. */
function segments(lines: Float32Array): number[][] {
  return Array.from({ length: lines.length / 6 }, (_, index) =>
    Array.from(lines.subarray(index * 6, index * 6 + 6))
  );
}

/** A `Float32Array` holds 24 bits of mantissa, so a vertex agrees with the literal to one part in 10^6. */
const RELATIVE_TOLERANCE = 1e-6;

function expectSegments(actual: Float32Array, expected: number[][]): void {
  const built = segments(actual);
  expect(built).toHaveLength(expected.length);
  expected.forEach((segment, index) =>
    segment.forEach((value, axis) => {
      const tolerance = RELATIVE_TOLERANCE * Math.max(1, Math.abs(value));
      expect(Math.abs(built[index]![axis]! - value)).toBeLessThanOrEqual(tolerance);
    })
  );
}

describe('decalGizmoLines', () => {
  it('draws the edges of equal y in full, the vertical edges as 20 % stubs and the tick (default size 2)', () => {
    expectSegments(decalGizmoLines(v(2)), [
      [1, -1, -1, -1, -1, -1],
      [1, -1, 1, 1, -1, -1],
      [-1, -1, 1, 1, -1, 1],
      [-1, -1, -1, -1, -1, 1],
      [-1, 1, -1, 1, 1, -1],
      [1, 1, -1, 1, 1, 1],
      [1, 1, 1, -1, 1, 1],
      [-1, 1, 1, -1, 1, -1],
      [-1, -1, 1, -1, -0.6, 1],
      [-1, 1, 1, -1, 0.6, 1],
      [-1, -1, -1, -1, -0.6, -1],
      [-1, 1, -1, -1, 0.6, -1],
      [1, -1, -1, 1, -0.6, -1],
      [1, 1, -1, 1, 0.6, -1],
      [1, -1, 1, 1, -0.6, 1],
      [1, 1, 1, 1, 0.6, 1],
      [0, 1, 0, 0, 1.2, 0],
    ]);
  });

  it('cuts the stubs by the height and the tick from the top face for size (4, 1, 2)', () => {
    expectSegments(decalGizmoLines(v(4, 1, 2)), [
      [2, -0.5, -1, -2, -0.5, -1],
      [2, -0.5, 1, 2, -0.5, -1],
      [-2, -0.5, 1, 2, -0.5, 1],
      [-2, -0.5, -1, -2, -0.5, 1],
      [-2, 0.5, -1, 2, 0.5, -1],
      [2, 0.5, -1, 2, 0.5, 1],
      [2, 0.5, 1, -2, 0.5, 1],
      [-2, 0.5, 1, -2, 0.5, -1],
      [-2, -0.5, 1, -2, -0.3, 1],
      [-2, 0.5, 1, -2, 0.3, 1],
      [-2, -0.5, -1, -2, -0.3, -1],
      [-2, 0.5, -1, -2, 0.3, -1],
      [2, -0.5, -1, 2, -0.3, -1],
      [2, 0.5, -1, 2, 0.3, -1],
      [2, -0.5, 1, 2, -0.3, 1],
      [2, 0.5, 1, 2, 0.3, 1],
      [0, 0.5, 0, 0, 0.6, 0],
    ]);
  });

  it.each([
    ['size 0', v(0)],
    ['a flat box of height 0', v(3, 0, 3)],
  ])('draws the vertical edges in full, with no stub, for %s (edge case)', (_label, size) => {
    expect(segments(decalGizmoLines(size))).toHaveLength(13);
  });

  it.each([
    ['(4, 1, 2)', v(4, 1, 2)],
    ['(1000, 200, 300)', v(1000, 200, 300)],
  ])('is the unit box scaled by size %s, so an animated size is a scale write (ADR-0017)', (_label, size) => {
    const unit = decalGizmoLines(v(1));
    const scaled = Float32Array.from(unit, (value, index) => value * [size.x, size.y, size.z][index % 3]!);
    expectSegments(decalGizmoLines(size), segments(scaled));
  });
});
