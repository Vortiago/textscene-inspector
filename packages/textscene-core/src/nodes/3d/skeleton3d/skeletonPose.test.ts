/**
 * The automatic skin of a Skeleton3D, ported from `skeleton_3d.cpp:975-1014` and the global rest and
 * pose of `:1085-1123` it is made of. A skin matrix moves a vertex at the global rest of its bone to
 * the global pose, so each test applies one to a point worked by hand. A quarter turn about Z takes
 * (0, -0.2, 0) to (0.2, 0, 0).
 */

import { describe, expect, it } from 'vitest';
import type { Quaternion } from '../../../godot/math/quaternion';
import { identityTransform3D, multiplyTransform3D, type Transform3D } from '../../../godot/math/transform3d';
import type { SkinBind } from '../../../resources/skin/types';
import {
  animationPass,
  automaticSkinMatrices,
  BonePoses,
  newBone,
  skinMatricesUnder,
  type Bone,
  type BonePose,
  type PoseModifier,
} from './skeletonPose';

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

/** Where the skin matrix of a bone takes the vertex at `from`. */
function moved(skin: Transform3D | undefined, from: [number, number, number]): Transform3D {
  return multiplyTransform3D(skin!, translation(...from));
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

describe('automaticSkinMatrices: global rest', () => {
  it('stands a bone with no parent on its rest, and a child on its parent times its rest', () => {
    // Every bone but the root sits at its rest, so the pose carries the global rest origin.
    const bones = CHAIN.map((b) => ({ ...b, position: { x: 0, y: 0, z: 0 } }));

    const skin = automaticSkinMatrices(bones, false);

    // Pose identity, so skin = inverse of global rest: the joints (0, 0.5), (0, 0.3), (0, 0.1) go to 0.
    expectOrigin(moved(skin[0], [0, 0.5, 0]), 0, 0, 0);
    expectOrigin(moved(skin[1], [0, 0.3, 0]), 0, 0, 0);
    expectOrigin(moved(skin[2], [0, 0.1, 0]), 0, 0, 0);
  });

  it('reads a parent that comes later in the table (edge case)', () => {
    const bones = [
      bone('child', 1, [0, -0.2, 0], { rotation: QUARTER_TURN_Z }),
      bone('root', -1, [0, 0.5, 0]),
    ];

    const skin = automaticSkinMatrices(bones, false);

    // The child's joint is at (0, 0.3, 0). The vertex 0.2 below it turns to 0.2 beside it.
    expectOrigin(moved(skin[0], [0, 0.3, 0]), 0, 0.3, 0);
    expectOrigin(moved(skin[0], [0, 0.1, 0]), 0.2, 0.3, 0);
  });

  it('turns a child with the rotation of its parent', () => {
    const bones = [
      { ...newBone('b0'), rest: quarterTurnZ() },
      { ...newBone('b1'), parent: 0, rest: translation(0, -0.2, 0) },
    ];

    const skin = automaticSkinMatrices(bones, false);

    // Pose identity, so the global rest origin of b1, (0.2, 0, 0), goes to the origin.
    expectOrigin(moved(skin[1], [0.2, 0, 0]), 0, 0, 0);
  });

  it('inverts the rotation of a rotated rest too', () => {
    const skin = automaticSkinMatrices([{ ...newBone('b0'), rest: quarterTurnZ() }], false);

    expect(skin[0]!.basis_x.y).toBeCloseTo(1, 6);
    expect(skin[0]!.basis_y.x).toBeCloseTo(-1, 6);
  });
});

describe('automaticSkinMatrices: global pose', () => {
  it('moves nothing when every bone sits at its rest, whatever the rest is', () => {
    const bones = [bone('b0', -1, [1, 2, 3]), bone('b1', 0, [-1, 0.5, 0])];

    automaticSkinMatrices(bones, false).forEach(expectIdentity);
  });

  it('multiplies the pose of each bone onto its parent', () => {
    const bones = [...CHAIN];
    bones[1] = { ...CHAIN[1]!, rotation: QUARTER_TURN_Z };

    const skin = automaticSkinMatrices(bones, false);

    // The bone at rest is where its bind pose puts it, so it does not move.
    expectIdentity(skin[0]);
    // The world origin turns a quarter about the joint (0, 0.3, 0) to (0.3, 0.3, 0), and so does the
    // bone below, which turns with it.
    for (const matrix of skin.slice(1)) {
      expectOrigin(matrix, 0.3, 0.3, 0);
      expect(matrix.basis_x.y).toBeCloseTo(-1, 5);
    }
    // The vertex at the lowest joint, (0, 0.1, 0), swings to the global pose of that bone.
    expectOrigin(moved(skin[2], [0, 0.1, 0]), 0.2, 0.3, 0);
  });

  it("builds a bone's pose from position, rotation and scale (`skeleton_3d.h:118-124`)", () => {
    const bones = [
      { ...newBone('b0'), rotation: QUARTER_TURN_Z, scale: { x: 2, y: 3, z: 4 } },
      { ...newBone('b1'), parent: 0, position: { x: 1, y: 0, z: 0 } },
    ];

    const skin = automaticSkinMatrices(bones, false);

    expect(skin[0]!.basis_x.y).toBeCloseTo(-3, 5);
    expect(skin[0]!.basis_y.x).toBeCloseTo(2, 5);
    // The child's (1, 0, 0) turns to (0, 1, 0) and the parent's scale stretches it by 2 along Y.
    expectOrigin(skin[1], 0, 2, 0);
  });

  it('uses the rest of a disabled bone in place of its pose, and its children stand on that', () => {
    const bones = [...CHAIN];
    bones[0] = { ...CHAIN[0]!, enabled: false, position: { x: 9, y: 9, z: 9 } };

    automaticSkinMatrices(bones, false).forEach(expectIdentity);
  });

  it('moves nothing under show_rest_only, however the bones are posed', () => {
    const bones = CHAIN.map((b) => ({ ...b, position: { x: 4, y: 4, z: 4 }, rotation: QUARTER_TURN_Z }));

    automaticSkinMatrices(bones, true).forEach(expectIdentity);
  });

  it('gives a bone that writes only rest the identity pose, not its rest', () => {
    const bones = [{ ...newBone('b0'), rest: translation(0, 0.5, 0) }];

    // Pose identity over a rest at (0, 0.5, 0): the skin carries the bind inverse alone.
    expectOrigin(automaticSkinMatrices(bones, false)[0], 0, -0.5, 0);
  });

  it('gives a child of such a bone the global pose of its parent (edge case)', () => {
    const bones = [
      { ...newBone('b0'), rest: translation(0, 0.5, 0) },
      { ...newBone('b1'), parent: 0, rest: translation(0, -0.2, 0) },
    ];

    expectOrigin(automaticSkinMatrices(bones, false)[1], 0, -0.3, 0);
  });

  it('treats a parent past the last bone as no parent, as Godot does (`:223-226`)', () => {
    const bones = [bone('b0', 7, [0, 0.5, 0], { position: { x: 0, y: 1.5, z: 0 } })];

    expectOrigin(automaticSkinMatrices(bones, false)[0], 0, 1, 0);
  });

  it('leaves the bones of a parent cycle at the identity, which no root reaches (edge case)', () => {
    const bones = [bone('a', 1, [1, 0, 0], { position: { x: 5, y: 0, z: 0 } }), bone('b', 0, [0, 1, 0])];

    automaticSkinMatrices(bones, false).forEach(expectIdentity);
  });

  it('gives a skeleton with no bone no skin (edge case)', () => {
    expect(automaticSkinMatrices([], false)).toEqual([]);
  });
});

/** A modifier that turns the bone `index` a quarter about Z at the given influence. */
function quarterTurner(index: number, influence = 1): PoseModifier {
  return { influence, edit: (poses) => poses.setPoseRotation(index, QUARTER_TURN_Z) };
}

describe('automaticSkinMatrices: modifiers', () => {
  it('makes the skin from the pose a modifier edits', () => {
    const skin = automaticSkinMatrices(CHAIN, false, [quarterTurner(2)]);

    // The vertex 0.2 below the lowest joint, (0, 0.1, 0), swings 0.2 beside it.
    expectOrigin(moved(skin[2], [0, -0.1, 0]), 0.2, 0.1, 0);
    expectIdentity(skin[0]);
    expectIdentity(skin[1]);
  });

  it('blends the edited pose back toward the old one by the influence (`skeleton_3d.cpp:1182-1196`)', () => {
    const skin = automaticSkinMatrices(CHAIN, false, [quarterTurner(2, 0.5)]);

    // Half the quarter turn is 45 degrees: (0, -0.2) from the joint goes to (0.1414, -0.1414).
    expectOrigin(moved(skin[2], [0, -0.1, 0]), Math.SQRT1_2 * 0.2, 0.1 - Math.SQRT1_2 * 0.2, 0);
  });

  it('applies an influence above one in full, as `influence < 1.0` gates the blend', () => {
    const skin = automaticSkinMatrices(CHAIN, false, [quarterTurner(2, 2)]);

    expectOrigin(moved(skin[2], [0, -0.1, 0]), 0.2, 0.1, 0);
  });

  it('leaves the skin of an influence of zero at the file pose', () => {
    automaticSkinMatrices(CHAIN, false, [quarterTurner(2, 0)]).forEach(expectIdentity);
  });

  it('lets the next modifier read the global poses the previous one wrote (`:1201`)', () => {
    let seenByNext: Transform3D | undefined;
    const reader: PoseModifier = {
      influence: 1,
      edit: (poses: BonePoses) => {
        seenByNext = poses.globalPose(2);
      },
    };

    automaticSkinMatrices(CHAIN, false, [quarterTurner(1), reader]);

    // The turn of b1 about its joint (0, 0.3, 0) takes b2 from (0, 0.1, 0) to (0.2, 0.3, 0).
    expectOrigin(seenByNext, 0.2, 0.3, 0);
  });

  it('runs the modifiers in order, so a later edit of the same bone wins', () => {
    const undo: PoseModifier = {
      influence: 1,
      edit: (poses) => poses.setPoseRotation(2, { x: 0, y: 0, z: 0, w: 1 }),
    };

    automaticSkinMatrices(CHAIN, false, [quarterTurner(2), undo]).forEach(expectIdentity);
  });

  it('keeps the file pose for the next run, since the modified pose feeds only the skin (`:405-412`)', () => {
    const before = structuredClone(CHAIN);

    automaticSkinMatrices(CHAIN, false, [quarterTurner(2)]);

    expect(CHAIN).toEqual(before);
    automaticSkinMatrices(CHAIN, false).forEach(expectIdentity);
  });

  it('still poses a skeleton under show_rest_only at its rest (`:1104`)', () => {
    automaticSkinMatrices(CHAIN, true, [quarterTurner(2)]).forEach(expectIdentity);
  });

  it('still poses a disabled bone at its rest', () => {
    const bones = [...CHAIN];
    bones[2] = { ...CHAIN[2]!, enabled: false };

    automaticSkinMatrices(bones, false, [quarterTurner(2)]).forEach(expectIdentity);
  });

  it('finds a bone by name, and gives -1 for a name the skeleton lacks', () => {
    const found: number[] = [];
    const finder: PoseModifier = {
      influence: 1,
      edit: (poses) => found.push(poses.findBone('b2'), poses.findBone('nope')),
    };

    automaticSkinMatrices(CHAIN, false, [finder]);

    expect(found).toEqual([2, -1]);
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

describe('animationPass', () => {
  const FILE_POSE = [
    bone('b0', -1, [0, 0.5, 0], { rotation: QUARTER_TURN_Z, scale: { x: 2, y: 2, z: 2 } }),
    bone('b1', 0, [0, -0.2, 0]),
  ];

  /** The bones of `FILE_POSE` after the pass for `animated` ran on them, and the names it found no bone for. */
  function passOver(
    animated: ReadonlyMap<string, BonePose>,
    motionScale = 1,
    bones: readonly Bone[] = FILE_POSE
  ): { poses: BonePoses; unknown: string[] } {
    const poses = new BonePoses(bones, false);
    const unknown: string[] = [];
    animationPass(animated, motionScale, (name) => unknown.push(name)).edit(poses);
    return { poses, unknown };
  }

  it('lays the parts a clip writes over the file pose of the bone it names, and leaves the other parts', () => {
    const { poses } = passOver(new Map([['b0', { position: [{ x: 1, y: 2, z: 3 }] }]]));

    expect(poses.posePosition(0)).toEqual({ x: 1, y: 2, z: 3 });
    expect(poses.poseRotation(0)).toEqual(QUARTER_TURN_Z);
    expect(poses.poseScale(0)).toEqual({ x: 2, y: 2, z: 2 });
    expect(poses.posePosition(1)).toEqual(FILE_POSE[1]!.position);
  });

  it('multiplies a position by the motion scale and nothing else, as the mixer does', () => {
    const { poses } = passOver(
      new Map([['b0', { position: [{ x: 1, y: 2, z: 3 }], scale: [{ x: 4, y: 5, z: 6 }] }]]),
      2
    );

    expect(poses.posePosition(0)).toEqual({ x: 2, y: 4, z: 6 });
    expect(poses.poseScale(0)).toEqual({ x: 4, y: 5, z: 6 });
  });

  it('normalises a rotation, as the blend of the mixer returns it', () => {
    const { poses } = passOver(new Map([['b0', { rotation: [{ x: 0, y: 0, z: 2, w: 0 }] }]]));

    expectQuaternionClose(poses.poseRotation(0), { x: 0, y: 0, z: 1, w: 0 });
  });

  it('writes a rotation relative to the rest rotation, so one track gives the keyed value (edge case)', () => {
    const rotated = [bone('b0', -1, [0, 0, 0], { rotation: QUARTER_TURN_Z, rest: quarterTurnZ() })];
    const keyed = { x: 0.5, y: 0.5, z: 0.5, w: 0.5 };

    const { poses } = passOver(new Map([['b0', { rotation: [keyed] }]]), 1, rotated);

    expectQuaternionClose(poses.poseRotation(0), keyed);
  });

  it('adds up the offsets from the rest of two position tracks on one bone, as the mixer does', () => {
    const { poses } = passOver(
      new Map([
        [
          'b0',
          {
            position: [
              { x: 1, y: 0.5, z: 0 },
              { x: 0, y: 1.5, z: 0 },
            ],
          },
        ],
      ])
    );

    expect(poses.posePosition(0)).toEqual({ x: 1, y: 1.5, z: 0 });
  });

  it('adds up the offsets from the rest of two scale tracks on one bone', () => {
    const { poses } = passOver(
      new Map([
        [
          'b1',
          {
            scale: [
              { x: 2, y: 1, z: 1 },
              { x: 3, y: 1, z: 1 },
            ],
          },
        ],
      ])
    );

    expect(poses.poseScale(1)).toEqual({ x: 4, y: 1, z: 1 });
  });

  it('composes two rotation tracks on one bone, the later one turning after the earlier', () => {
    const { poses } = passOver(new Map([['b1', { rotation: [QUARTER_TURN_Z, QUARTER_TURN_Z] }]]));

    expectQuaternionClose(poses.poseRotation(1), { x: 0, y: 0, z: 1, w: 0 });
  });

  it('writes the first bone of a name, which is the one find_bone answers', () => {
    const twins = [bone('twin', -1, [0, 0, 0]), bone('twin', -1, [0, 0, 0])];

    const { poses } = passOver(new Map([['twin', { position: [{ x: 1, y: 1, z: 1 }] }]]), 1, twins);

    expect(poses.posePosition(0)).toEqual({ x: 1, y: 1, z: 1 });
    expect(poses.posePosition(1)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('reports each name the skeleton lacks, and writes the others', () => {
    const { poses, unknown } = passOver(
      new Map<string, BonePose>([
        ['ghost', { position: [{ x: 9, y: 9, z: 9 }] }],
        ['b1', { position: [{ x: 1, y: 1, z: 1 }] }],
        ['other', {}],
      ])
    );

    expect(unknown).toEqual(['ghost', 'other']);
    expect(poses.posePosition(1)).toEqual({ x: 1, y: 1, z: 1 });
  });
});

function expectQuaternionClose(actual: Quaternion, expected: Quaternion): void {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
  expect(actual.z).toBeCloseTo(expected.z, 6);
  expect(actual.w).toBeCloseTo(expected.w, 6);
}

describe('skinMatricesUnder: one BonePoses across frames', () => {
  const posed = (x: number): PoseModifier => ({
    influence: 1,
    edit: (poses) => poses.setPosePosition(0, { x, y: 0.5, z: 0 }),
  });

  it('starts every frame from the file pose, so an edit of one frame does not reach the next', () => {
    const poses = new BonePoses(CHAIN, false);

    skinMatricesUnder(poses, [posed(3)]);

    skinMatricesUnder(poses, []).forEach(expectIdentity);
  });

  it('answers what a new BonePoses answers for the same modifiers', () => {
    const poses = new BonePoses(CHAIN, false);
    skinMatricesUnder(poses, [quarterTurner(2)]);

    expect(skinMatricesUnder(poses, [posed(1)])).toEqual(automaticSkinMatrices(CHAIN, false, [posed(1)]));
  });
});

describe('the rig of a BonePoses', () => {
  it('finds the first bone of a name, and -1 for a name no bone carries', () => {
    const { rig } = new BonePoses(
      [bone('a', -1, [0, 0, 0]), bone('b', 0, [0, 0, 0]), bone('b', 0, [0, 1, 0])],
      false
    );

    expect([rig.findBone('b'), rig.findBone('nope')]).toEqual([1, -1]);
  });

  it('hands back the same taken-apart rest each time a bone asks', () => {
    const { rig } = new BonePoses(CHAIN, false);

    expect(rig.decomposedRest(1)).toBe(rig.decomposedRest(1));
  });
});

/** A bind of a Skin that names a bone: the inverse of the rest the bone was bound at. */
function namedBind(name: string, bindOrigin: [number, number, number]): SkinBind {
  return { bone: -1, name, pose: translation(...bindOrigin) };
}

/** A bind of a Skin that addresses a bone by its index. */
function indexedBind(bone: number, bindOrigin: [number, number, number]): SkinBind {
  return { bone, name: '', pose: translation(...bindOrigin) };
}

/** The chain of {@link CHAIN} below a root bone `extra`, so the automatic skin would bind the wrong bones. */
const CHAIN_UNDER_EXTRA: Bone[] = [
  bone('extra', -1, [0, 0, 0]),
  { ...CHAIN[0]! },
  { ...CHAIN[1]!, parent: 1 },
  { ...CHAIN[2]!, parent: 2 },
];

/** The binds that put each bone of {@link CHAIN} at the identity while it rests. */
const CHAIN_BINDS_BY_NAME = [
  namedBind('b0', [0, -0.5, 0]),
  namedBind('b1', [0, -0.3, 0]),
  namedBind('b2', [0, -0.1, 0]),
];

function skinUnder(bones: readonly Bone[], binds: readonly SkinBind[], modifiers: PoseModifier[] = []) {
  const poses = new BonePoses(bones, false);
  const unresolved: string[] = [];
  const bindings = poses.resolveBinds(binds, (message) => unresolved.push(message));
  const matrices = skinMatricesUnder(poses, modifiers, bindings);
  return { matrices, unresolved };
}

describe('skinMatricesUnder: the binds of a Skin', () => {
  it('has one matrix for each bind, not for each bone (`skeleton_3d.cpp:363-403`)', () => {
    expect(skinUnder(CHAIN_UNDER_EXTRA, CHAIN_BINDS_BY_NAME).matrices).toHaveLength(3);
  });

  it('moves nothing at the rest when each bind pose is the inverse of its bone rest', () => {
    skinUnder(CHAIN_UNDER_EXTRA, CHAIN_BINDS_BY_NAME).matrices.forEach(expectIdentity);
  });

  it('finds a bone by the name of its bind, wherever the bone sits in the table', () => {
    const bones = [...CHAIN_UNDER_EXTRA];
    bones[2] = { ...bones[2]!, rotation: QUARTER_TURN_Z };

    const { matrices } = skinUnder(bones, CHAIN_BINDS_BY_NAME);

    // The same turn of b1 as the automatic skin of CHAIN alone: the extra root takes no bind.
    expectIdentity(matrices[0]);
    expectOrigin(matrices[1], 0.3, 0.3, 0);
    expectOrigin(matrices[2], 0.3, 0.3, 0);
  });

  it('finds the bone by its index where the bind has no name', () => {
    const binds = [indexedBind(1, [0, -0.5, 0]), indexedBind(2, [0, -0.3, 0]), indexedBind(3, [0, -0.1, 0])];

    skinUnder(CHAIN_UNDER_EXTRA, binds).matrices.forEach(expectIdentity);
  });

  it('prefers the name over the index', () => {
    const bind: SkinBind = { bone: 0, name: 'b0', pose: translation(0, -0.5, 0) };

    expectIdentity(skinUnder(CHAIN_UNDER_EXTRA, [bind]).matrices[0]);
  });

  it('takes the first bone of a name', () => {
    const twins = [bone('twin', -1, [0, 0, 0]), bone('twin', -1, [0, 7, 0])];

    expectIdentity(skinUnder(twins, [namedBind('twin', [0, 0, 0])]).matrices[0]);
  });

  it('multiplies the global pose of the bone by the bind pose, in that order', () => {
    const bones = [bone('b', -1, [0, 0, 0], { rotation: QUARTER_TURN_Z })];

    const { matrices } = skinUnder(bones, [namedBind('b', [1, 0, 0])]);

    // The quarter turn takes the bind origin (1, 0, 0) to (0, 1, 0). Bind first would leave (1, 0, 0).
    expectOrigin(matrices[0], 0, 1, 0);
  });

  it('binds bone 0 and says so for a name no bone carries (`:379`)', () => {
    const { matrices, unresolved } = skinUnder(CHAIN_UNDER_EXTRA, [namedBind('ghost', [0, 2, 0])]);

    expectOrigin(matrices[0], 0, 2, 0);
    expect(unresolved).toEqual([expect.stringContaining('"ghost"')]);
  });

  it('binds bone 0 and says so for an index at or past the bone count (`:385`)', () => {
    const bones = [bone('only', -1, [0, 0, 0], { position: { x: 4, y: 0, z: 0 } })];

    const { matrices, unresolved } = skinUnder(bones, [indexedBind(1, [0, 0, 0])]);

    expectOrigin(matrices[0], 4, 0, 0);
    expect(unresolved).toEqual([expect.stringContaining('bone count')]);
  });

  it('binds bone 0 and says so for a bind with neither a name nor an index (`:391`)', () => {
    const { unresolved } = skinUnder(CHAIN_UNDER_EXTRA, [
      { bone: -1, name: '', pose: identityTransform3D() },
    ]);

    expect(unresolved).toEqual([expect.stringContaining('neither a name nor a bone')]);
  });

  it('runs the modifiers before the binds read the global pose', () => {
    const { matrices } = skinUnder(CHAIN_UNDER_EXTRA, CHAIN_BINDS_BY_NAME, [quarterTurner(2)]);

    expectOrigin(matrices[1], 0.3, 0.3, 0);
  });

  it('gives a Skin with no bind no matrix (edge case)', () => {
    expect(skinUnder(CHAIN_UNDER_EXTRA, []).matrices).toEqual([]);
  });
});
