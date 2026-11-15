/**
 * The kite Godot's editor draws for a Bone2D (`skeleton_2d.cpp:313-354`), as polygons in the
 * bone's own space once the gizmo has undone the bone's global scale (`skeleton_2d.cpp:208-211`).
 * Expected points are worked by hand from `_editor_get_bone_shape` with `bone_width` 5 and
 * `bone_outline_size` 2 (`editor_settings.cpp:974,980`).
 */

import { describe, expect, it } from 'vitest';
import { TRANSFORM2D_IDENTITY, transform2DFromParts } from '../../../godot/math/transform2d.js';
import { boneKitesOf } from './boneKite';

const NO_FALLBACK = { length: 0, angle: 0 };

function expectPoints(actual: readonly { x: number; y: number }[], expected: readonly [number, number][]) {
  expect(actual).toHaveLength(expected.length);
  expected.forEach(([x, y], i) => {
    expect(actual[i]!.x).toBeCloseTo(x, 4);
    expect(actual[i]!.y).toBeCloseTo(y, 4);
  });
}

describe('boneKitesOf', () => {
  it('draws the kite from the bone to a child along +x', () => {
    const [kite] = boneKitesOf(TRANSFORM2D_IDENTITY, [{ x: 100, y: 0 }], NO_FALLBACK);
    expectPoints(kite!.fill, [
      [0, 0],
      [20, 5],
      [100, 0],
      [20, -5],
    ]);
    expectPoints(kite!.outline, [
      [-2, -2],
      [-2, 2],
      [20, 7],
      [102, 2],
      [102, -2],
      [20, -7],
    ]);
  });

  it('draws one kite for each child bone, in order', () => {
    const kites = boneKitesOf(
      TRANSFORM2D_IDENTITY,
      [
        { x: 100, y: 0 },
        { x: 0, y: 50 },
      ],
      NO_FALLBACK
    );
    expect(kites).toHaveLength(2);
    expectPoints(kites[1]!.fill, [
      [0, 0],
      [-5, 10],
      [0, 50],
      [5, 10],
    ]);
  });

  it('keeps the kite width in pixels when the bone is scaled, and the tip on the child', () => {
    // A bone scaled 2 whose child sits at local (50, 0): the child's global position is (100, 0).
    const global = transform2DFromParts(0, { x: 2, y: 2 }, 0, { x: 0, y: 0 });
    const [kite] = boneKitesOf(global, [{ x: 100, y: 0 }], NO_FALLBACK);
    // The gizmo draws in the bone's space, so its scale of 2 maps these back to 5 pixels wide.
    expectPoints(kite!.fill, [
      [0, 0],
      [10, 2.5],
      [50, 0],
      [10, -2.5],
    ]);
  });

  it('undoes the bone rotation of the child offset, so the kite is not rotated twice', () => {
    // The bone turns a quarter, so a child at global (0, 100) sits at local (100, 0).
    const global = transform2DFromParts(Math.PI / 2, { x: 1, y: 1 }, 0, { x: 0, y: 0 });
    const [kite] = boneKitesOf(global, [{ x: 0, y: 100 }], NO_FALLBACK);
    expectPoints(kite!.fill, [
      [0, 0],
      [20, 5],
      [100, 0],
      [20, -5],
    ]);
  });

  it('draws the length and angle for a bone with no child, scaled by the global scale', () => {
    const [kite] = boneKitesOf(TRANSFORM2D_IDENTITY, [], { length: 40, angle: Math.PI / 2 });
    expectPoints(kite!.fill, [
      [0, 0],
      [-5, 8],
      [0, 40],
      [5, 8],
    ]);
  });

  it('draws nothing for a bone with no child and no length', () => {
    expect(boneKitesOf(TRANSFORM2D_IDENTITY, [], { length: 0, angle: 0 })).toEqual([]);
  });

  it('draws a degenerate kite for a child at the bone origin, as Godot normalises zero to zero', () => {
    const [kite] = boneKitesOf(TRANSFORM2D_IDENTITY, [{ x: 0, y: 0 }], NO_FALLBACK);
    expectPoints(kite!.fill, [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ]);
  });

  it('draws nothing for a bone with a zero global scale, whose gizmo transform divides by zero', () => {
    const flat = transform2DFromParts(0, { x: 0, y: 1 }, 0, { x: 0, y: 0 });
    expect(boneKitesOf(flat, [{ x: 100, y: 0 }], NO_FALLBACK)).toEqual([]);
  });
});
