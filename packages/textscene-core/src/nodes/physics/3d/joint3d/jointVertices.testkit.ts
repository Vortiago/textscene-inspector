/** Helpers every Joint3D gizmo test shares: vertex reads, a close comparison and the expected part colours. Test-only. */
import { expect } from 'vitest';
import { godotColorToLinear } from '../../../../r3f/godotColor';

/** The linear colours of `editors/3d_gizmos/gizmo_colors/joint`, `joint_body_a` and `joint_body_b`, as the Godot source lists them. */
export const EXPECTED_PART_COLOURS = {
  joint: godotColorToLinear({ r: 0.5, g: 0.8, b: 1 }).toArray(),
  bodyA: godotColorToLinear({ r: 0.6, g: 0.8, b: 1 }).toArray(),
  bodyB: godotColorToLinear({ r: 0.6, g: 0.9, b: 1 }).toArray(),
};

/** The vertex at `index` of flat segment ends. */
export function vertex(positions: ArrayLike<number>, index: number): number[] {
  return Array.from({ length: 3 }, (_, axis) => positions[index * 3 + axis]!);
}

/** Expects `actual` to match `expected` to five decimals, which float32 rounding in Godot's port allows. */
export function expectClose(actual: ArrayLike<number>, expected: readonly number[]) {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((value, index) => expect(actual[index]).toBeCloseTo(value, 5));
}
