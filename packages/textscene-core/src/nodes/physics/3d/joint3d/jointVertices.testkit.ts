/** Helpers every Joint3D gizmo test shares: vertex reads, a close comparison and the expected part colours. Test-only. */
import { expect } from 'vitest';
import { transform3DOf, type Transform3D } from '../../../../godot/math/transform3d';
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

/** The place of the joint and its two bodies in `twoBodyScene`: unrotated, with each body away from the joint and not straight above or below it. */
export const TWO_BODY_ORIGINS = {
  joint: { x: 0.5, y: 0, z: 0.5 },
  bodyA: { x: 2, y: 1, z: -1 },
  bodyB: { x: -1, y: 0.5, z: 2 },
};

/** A transform at `origin` with no rotation. */
export function unrotatedAt(origin: { x: number; y: number; z: number }): Transform3D {
  return transform3DOf([1, 0, 0, 0, 1, 0, 0, 0, 1], origin);
}

/** {@link TWO_BODY_ORIGINS} as transforms. */
export const TWO_BODY_TRANSFORMS = {
  joint: unrotatedAt(TWO_BODY_ORIGINS.joint),
  bodyA: unrotatedAt(TWO_BODY_ORIGINS.bodyA),
  bodyB: unrotatedAt(TWO_BODY_ORIGINS.bodyB),
};
