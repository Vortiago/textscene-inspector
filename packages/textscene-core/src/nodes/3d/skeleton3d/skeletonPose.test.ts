/**
 * The automatic skin of a Skeleton3D, ported from `skeleton_3d.cpp:975-1014` and the global rest and
 * pose of `:1085-1123` it is made of. A skin matrix moves a vertex at the global rest of its bone to
 * the global pose, so each test applies one to a point worked by hand. A quarter turn about Z takes
 * (0, -0.2, 0) to (0.2, 0, 0).
 */

import { describe, expect, it } from 'vitest';
import { identityTransform3D, multiplyTransform3D, type Transform3D } from '../../../godot/math/transform3d';
import {
  animatedBones,
  automaticSkinMatrices,
  newBone,
  unknownBoneNames,
  type Bone,
  type BonePoses,
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

describe('animatedBones', () => {
  const FILE_POSE = [
    bone('b0', -1, [0, 0.5, 0], { rotation: QUARTER_TURN_Z, scale: { x: 2, y: 2, z: 2 } }),
    bone('b1', 0, [0, -0.2, 0]),
  ];

  it('lays the parts a clip writes over the file pose of the bone it names, and leaves the other parts', () => {
    const [first, second] = animatedBones(
      FILE_POSE,
      new Map([['b0', { position: { x: 1, y: 2, z: 3 } }]]),
      1
    );

    expect(first).toEqual({ ...FILE_POSE[0], position: { x: 1, y: 2, z: 3 } });
    expect(second).toBe(FILE_POSE[1]);
  });

  it('multiplies a position by the motion scale and nothing else, as the mixer does', () => {
    const [first] = animatedBones(
      FILE_POSE,
      new Map([['b0', { position: { x: 1, y: 2, z: 3 }, scale: { x: 4, y: 5, z: 6 } }]]),
      2
    );

    expect(first!.position).toEqual({ x: 2, y: 4, z: 6 });
    expect(first!.scale).toEqual({ x: 4, y: 5, z: 6 });
  });

  it('normalises a rotation, as the blend of the mixer returns it', () => {
    const [first] = animatedBones(FILE_POSE, new Map([['b0', { rotation: { x: 0, y: 0, z: 2, w: 0 } }]]), 1);

    expect(first!.rotation).toEqual({ x: 0, y: 0, z: 1, w: 0 });
  });

  it('writes the first bone of a name, which is the one find_bone answers', () => {
    const twins = [bone('twin', -1, [0, 0, 0]), bone('twin', -1, [0, 0, 0])];

    const [first, second] = animatedBones(twins, new Map([['twin', { position: { x: 1, y: 1, z: 1 } }]]), 1);

    expect(first!.position).toEqual({ x: 1, y: 1, z: 1 });
    expect(second).toBe(twins[1]);
  });

  it('changes nothing for a name the skeleton lacks', () => {
    expect(animatedBones(FILE_POSE, new Map([['ghost', { position: { x: 9, y: 9, z: 9 } }]]), 1)).toEqual(
      FILE_POSE
    );
  });
});

describe('unknownBoneNames', () => {
  it('lists the names of a pose that no bone of the skeleton carries', () => {
    const pose = new Map([
      ['b0', {}],
      ['ghost', {}],
      ['other', {}],
    ]);

    expect(unknownBoneNames(new Set(CHAIN.map((bone) => bone.name)), pose)).toEqual(['ghost', 'other']);
  });
});
