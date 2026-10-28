/**
 * The pose model of a Skeleton3D, ported from `skeleton_3d.cpp:1085-1123` (global rest and global
 * pose) and `:975-1014` (the automatic skin). Every expected value is worked by hand from a
 * rotation of a quarter turn about Z, which takes (0, -0.2, 0) to (0.2, 0, 0).
 */

import { describe, expect, it } from 'vitest';
import { identityTransform3D, multiplyTransform3D, type Transform3D } from '../../../godot/math/transform3d';
import { newBone, poseSkeleton, type Bone } from './skeletonPose';

const QUARTER_TURN_Z = { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 };

function translation(x: number, y: number, z: number): Transform3D {
  return { ...identityTransform3D(), origin: { x, y, z } };
}

/** A bone whose rest is a translation, posed at that same translation unless `pose` says otherwise. */
function bone(
  name: string,
  parent: number,
  rest: [number, number, number],
  overrides: Partial<Bone> = {}
): Bone {
  const [x, y, z] = rest;
  return {
    ...newBone(name),
    parent,
    rest: translation(x, y, z),
    position: { x, y, z },
    ...overrides,
  };
}

function expectOrigin(transform: Transform3D | undefined, x: number, y: number, z: number): void {
  expect(transform!.origin.x).toBeCloseTo(x, 6);
  expect(transform!.origin.y).toBeCloseTo(y, 6);
  expect(transform!.origin.z).toBeCloseTo(z, 6);
}

function expectIdentity(transform: Transform3D | undefined): void {
  expect(transform!.basis_x.x).toBeCloseTo(1, 6);
  expect(transform!.basis_y.y).toBeCloseTo(1, 6);
  expect(transform!.basis_z.z).toBeCloseTo(1, 6);
  expectOrigin(transform, 0, 0, 0);
}

const CHAIN: Bone[] = [bone('b0', -1, [0, 0.5, 0]), bone('b1', 0, [0, -0.2, 0]), bone('b2', 1, [0, -0.2, 0])];

describe('newBone', () => {
  it("starts a bone at Godot's defaults: enabled, identity pose, no parent (`skeleton_3d.h:105-113`)", () => {
    expect(newBone('b')).toEqual({
      name: 'b',
      parent: -1,
      rest: identityTransform3D(),
      enabled: true,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    });
  });
});

describe('poseSkeleton: global rest', () => {
  it('takes the rest of a bone with no parent as it is, and a child as its parent times its rest', () => {
    const { globalRests } = poseSkeleton(CHAIN, false);

    expectOrigin(globalRests[0], 0, 0.5, 0);
    expectOrigin(globalRests[1], 0, 0.3, 0);
    expectOrigin(globalRests[2], 0, 0.1, 0);
  });

  it('reads a parent that comes later in the table (edge case)', () => {
    const bones = [bone('child', 1, [0, -0.2, 0]), bone('root', -1, [0, 0.5, 0])];

    expectOrigin(poseSkeleton(bones, false).globalRests[0], 0, 0.3, 0);
  });

  it('turns a child with the rotation of its parent', () => {
    const bones = [
      bone('b0', -1, [0, 0, 0], { rest: multiplyTransform3D(translation(0, 0, 0), quarterTurnZ()) }),
      bone('b1', 0, [0, -0.2, 0]),
    ];

    expectOrigin(poseSkeleton(bones, false).globalRests[1], 0.2, 0, 0);
  });
});

describe('poseSkeleton: global pose', () => {
  it('multiplies the pose of each bone onto its parent', () => {
    const { globalPoses } = poseSkeleton(CHAIN, false);

    expectOrigin(globalPoses[0], 0, 0.5, 0);
    expectOrigin(globalPoses[2], 0, 0.1, 0);
  });

  it("builds a bone's pose from position, rotation and scale (`skeleton_3d.h:118-124`)", () => {
    const bones = [
      bone('b0', -1, [0, 0, 0], { rotation: QUARTER_TURN_Z, scale: { x: 2, y: 3, z: 4 } }),
      bone('b1', 0, [0, 0, 0], { position: { x: 1, y: 0, z: 0 } }),
    ];

    const { globalPoses } = poseSkeleton(bones, false);

    expect(globalPoses[0]!.basis_x.y).toBeCloseTo(-3, 5);
    expect(globalPoses[0]!.basis_y.x).toBeCloseTo(2, 5);
    // The child's (1, 0, 0) turns to (0, 1, 0) and the parent's scale stretches it by 2 along Y.
    expectOrigin(globalPoses[1], 0, 2, 0);
  });

  it('turns every bone below a rotated bone', () => {
    const bones = [...CHAIN];
    bones[1] = { ...CHAIN[1]!, rotation: QUARTER_TURN_Z };

    const { globalPoses } = poseSkeleton(bones, false);

    expectOrigin(globalPoses[1], 0, 0.3, 0);
    expectOrigin(globalPoses[2], 0.2, 0.3, 0);
  });

  it('uses the rest of a disabled bone in place of its pose, and its children stand on that', () => {
    const bones = [...CHAIN];
    bones[0] = { ...CHAIN[0]!, enabled: false, position: { x: 9, y: 9, z: 9 } };

    const { globalPoses } = poseSkeleton(bones, false);

    expectOrigin(globalPoses[0], 0, 0.5, 0);
    expectOrigin(globalPoses[2], 0, 0.1, 0);
  });

  it('uses the rest of every bone when show_rest_only is true', () => {
    const bones = CHAIN.map((b) => ({ ...b, position: { x: 9, y: 9, z: 9 } }));

    const { globalPoses } = poseSkeleton(bones, true);

    expectOrigin(globalPoses[0], 0, 0.5, 0);
    expectOrigin(globalPoses[2], 0, 0.1, 0);
  });

  it('gives a bone that writes only rest the identity pose, not its rest', () => {
    const bones = [{ ...newBone('b0'), rest: translation(0, 0.5, 0) }];

    expectIdentity(poseSkeleton(bones, false).globalPoses[0]);
  });

  it('gives a child of such a bone the global pose of its parent (edge case)', () => {
    const bones = [
      { ...newBone('b0'), rest: translation(0, 0.5, 0) },
      { ...newBone('b1'), parent: 0, rest: translation(0, -0.2, 0) },
    ];

    expectIdentity(poseSkeleton(bones, false).globalPoses[1]);
  });

  it('treats a parent past the last bone as no parent, as Godot does (`:223-226`)', () => {
    const bones = [bone('b0', 7, [0, 0.5, 0])];

    const { globalRests, globalPoses } = poseSkeleton(bones, false);

    expectOrigin(globalRests[0], 0, 0.5, 0);
    expectOrigin(globalPoses[0], 0, 0.5, 0);
  });

  it('leaves the bones of a parent cycle at the identity, which no root reaches (edge case)', () => {
    const bones = [bone('a', 1, [1, 0, 0]), bone('b', 0, [0, 1, 0])];

    const { globalRests, globalPoses } = poseSkeleton(bones, false);

    expectIdentity(globalRests[0]);
    expectIdentity(globalPoses[1]);
  });

  it('poses a skeleton with no bone as no pose (edge case)', () => {
    expect(poseSkeleton([], false)).toEqual({
      globalRests: [],
      globalPoses: [],
      automaticBindPoses: [],
      automaticSkinMatrices: [],
    });
  });
});

describe('poseSkeleton: the automatic skin', () => {
  it('binds each bone to the inverse of its global rest (`:1014`)', () => {
    const { globalRests, automaticBindPoses } = poseSkeleton(CHAIN, false);

    automaticBindPoses.forEach((bind, i) => expectIdentity(multiplyTransform3D(globalRests[i]!, bind)));
    expectOrigin(automaticBindPoses[2], 0, -0.1, 0);
  });

  it('inverts the rotation of a rotated rest too', () => {
    const bones = [bone('b0', -1, [0, 0, 0], { rest: quarterTurnZ() })];

    const bind = poseSkeleton(bones, false).automaticBindPoses[0]!;

    expect(bind.basis_x.y).toBeCloseTo(1, 6);
    expect(bind.basis_y.x).toBeCloseTo(-1, 6);
  });

  it('multiplies the global pose of the bone onto its bind pose (`:398-403`)', () => {
    const bones = [...CHAIN];
    bones[1] = { ...CHAIN[1]!, rotation: QUARTER_TURN_Z };

    const { automaticSkinMatrices } = poseSkeleton(bones, false);

    // The bone at rest is where its bind pose puts it, so it does not move.
    expectIdentity(automaticSkinMatrices[0]);
    // The world origin turns a quarter about the joint (0, 0.3, 0) to (0.3, 0.3, 0), and so does the
    // bone below, which turns with it.
    for (const matrix of automaticSkinMatrices.slice(1)) {
      expectOrigin(matrix, 0.3, 0.3, 0);
      expect(matrix.basis_x.y).toBeCloseTo(-1, 5);
    }
    // The vertex at the lowest joint, (0, 0.1, 0), swings to the global pose of that bone.
    expectOrigin(multiplyTransform3D(automaticSkinMatrices[2]!, translation(0, 0.1, 0)), 0.2, 0.3, 0);
  });

  it('moves nothing when every bone sits at its rest, whatever the rest is', () => {
    const bones = [
      bone('b0', -1, [1, 2, 3]),
      bone('b1', 0, [-1, 0.5, 0], { rotation: { x: 0, y: 0, z: 0, w: 1 } }),
    ];

    poseSkeleton(bones, false).automaticSkinMatrices.forEach(expectIdentity);
  });

  it('moves nothing under show_rest_only, however the bones are posed', () => {
    const bones = CHAIN.map((b) => ({ ...b, position: { x: 4, y: 4, z: 4 }, rotation: QUARTER_TURN_Z }));

    poseSkeleton(bones, true).automaticSkinMatrices.forEach(expectIdentity);
  });
});

function quarterTurnZ(): Transform3D {
  return {
    basis_x: { x: 0, y: -1, z: 0 },
    basis_y: { x: 1, y: 0, z: 0 },
    basis_z: { x: 0, y: 0, z: 1 },
    origin: { x: 0, y: 0, z: 0 },
  };
}
