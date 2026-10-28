/**
 * CopyTransformModifier3D on a six-bone chain. Each expected pose is what Godot 4.6.3 reports for
 * the same bones and settings, read in the `modification_processed` signal of the modifier.
 */

import { describe, expect, it } from 'vitest';
import { basisFromQuaternion } from '../../../../godot/math/basis';
import type { Quaternion } from '../../../../godot/math/quaternion';
import { quaternionFromAxisAngle } from '../../../../godot/math/quaternion';
import {
  identityTransform3D,
  multiplyTransform3D,
  transform3DFromQuaternionScale,
  type Transform3D,
} from '../../../../godot/math/transform3d';
import type { Vector3 } from '../../../../godot/math/vector';
import { BonePoses, newBone, type Bone, type PoseModifier } from '../../skeleton3d/skeletonPose';
import type { TscnNode } from '../../../../parser/types';
import type { ModifierWorld } from '../../skeleton3d/poseModifier';
import { newConstraintSetting } from '../boneconstraint3d/settings';
import { readCopyTransformModifier } from './copyTransformModifier';
import type { CopyTransformModifier3DProperties, CopyTransformSetting } from './types';

const UP = { x: 0, y: 1, z: 0 };
const ONE = { x: 1, y: 1, z: 1 };
const DOWN = { x: 0, y: -0.2, z: 0 };
const FORWARD = { x: 0, y: 0, z: 1 };
const COPY_POSITION = 1;
const COPY_ROTATION = 2;
const COPY_SCALE = 4;
const AXIS_X = 1;
const AXIS_Y = 2;
const AXIS_Z = 4;

function translation(x: number, y: number, z: number): Transform3D {
  return { ...identityTransform3D(), origin: { x, y, z } };
}

/** Six bones in a chain, each resting 0.2 below its parent, with b2 turned 60 degrees about Z. */
function chain(overrides: Record<number, Partial<Bone>> = {}): Bone[] {
  return [0, 1, 2, 3, 4, 5].map((index) => {
    const origin = { x: 0, y: index === 0 ? 0.5 : -0.2, z: 0 };
    return {
      ...newBone(`b${index}`),
      parent: index - 1,
      rest: translation(origin.x, origin.y, origin.z),
      position: origin,
      rotation: index === 2 ? { x: 0, y: 0, z: 0.5, w: 0.866025 } : { x: 0, y: 0, z: 0, w: 1 },
      ...overrides[index],
    };
  });
}

function setting(overrides: Partial<CopyTransformSetting> = {}): CopyTransformSetting {
  return {
    ...newConstraintSetting(),
    copyFlags: 7,
    axisFlags: 7,
    invertFlags: 0,
    relative: true,
    additive: false,
    applyBoneName: 'b4',
    referenceBoneName: 'b2',
    ...overrides,
  };
}

const NO_NODES: ModifierWorld = { skeletonGlobal: identityTransform3D(), nodeGlobal: () => null };

function properties(
  settings: CopyTransformSetting[],
  extra: Partial<CopyTransformModifier3DProperties> = {}
): CopyTransformModifier3DProperties {
  return { name: 'Mod', active: true, influence: 1, settings, ...extra };
}

/** The edit the registration reads from a node with `settings`, or null. */
function readModifier(
  settings: CopyTransformSetting[],
  extra: Partial<CopyTransformModifier3DProperties>,
  world: ModifierWorld
): PoseModifier | null {
  const node = { type: 'CopyTransformModifier3D', name: 'Mod', properties: properties(settings, extra) };
  return readCopyTransformModifier(node as TscnNode, world);
}

/** The poses after the modifier edits `bones`. */
function edited(bones: Bone[], settings: CopyTransformSetting[], world: ModifierWorld = NO_NODES): BonePoses {
  const poses = new BonePoses(bones, false);
  readModifier(settings, {}, world)!.edit(poses);
  return poses;
}

function expectVector(actual: Vector3, expected: [number, number, number]): void {
  expect(actual.x).toBeCloseTo(expected[0], 6);
  expect(actual.y).toBeCloseTo(expected[1], 6);
  expect(actual.z).toBeCloseTo(expected[2], 6);
}

function expectRotation(actual: Quaternion, expected: [number, number, number, number]): void {
  expect(actual.x).toBeCloseTo(expected[0], 6);
  expect(actual.y).toBeCloseTo(expected[1], 6);
  expect(actual.z).toBeCloseTo(expected[2], 6);
  expect(actual.w).toBeCloseTo(expected[3], 6);
}

/** b2 posed to show every part of a transform: a tilted turn, a shifted origin and a stretch. */
const POSED_B2: Partial<Bone> = {
  rotation: quaternionFromAxisAngle(FORWARD, 0.9),
  position: { x: 0.1, y: -0.25, z: 0.05 },
  scale: { x: 1.5, y: 0.8, z: 1.2 },
};
/** A turn about an axis that no single world axis holds, so a mask has something to remove. */
const OFF_AXIS_B2: Partial<Bone> = { rotation: quaternionFromAxisAngle({ x: 0.3, y: 0.5, z: 0.8 }, 1.1) };

describe('readCopyTransformModifier', () => {
  it('copies the rotation of the reference bone onto the apply bone, and nothing else', () => {
    const poses = edited(chain(), [setting({ copyFlags: COPY_ROTATION })]);

    expectRotation(poses.poseRotation(4), [0, 0, 0.50000024, 0.86602527]);
    expectVector(poses.posePosition(4), [0, -0.2, 0]);
    expectVector(poses.poseScale(4), [1, 1, 1]);
    expectRotation(poses.poseRotation(5), [0, 0, 0, 1]);
  });

  it('copies the position alone when the position flag is the only one', () => {
    const poses = edited(chain({ 2: { position: { x: 0.1, y: -0.25, z: 0.05 } } }), [
      setting({ copyFlags: COPY_POSITION }),
    ]);

    expectVector(poses.posePosition(4), [0.1, -0.25, 0.05]);
    expectRotation(poses.poseRotation(4), [0, 0, 0, 1]);
  });

  it('copies the scale alone when the scale flag is the only one', () => {
    const poses = edited(chain({ 2: { scale: { x: 1.5, y: 0.8, z: 1.2 } } }), [
      setting({ copyFlags: COPY_SCALE }),
    ]);

    expectVector(poses.poseScale(4), [1.5000001, 0.8, 1.2]);
    expectRotation(poses.poseRotation(4), [0, 0, 0, 1]);
    expectVector(poses.posePosition(4), [0, -0.2, 0]);
  });

  it('adds the copy to the pose of the apply bone when additive (`:476-480`)', () => {
    const poses = edited(chain({ 4: { rotation: quaternionFromAxisAngle(UP, 0.5) } }), [
      setting({ copyFlags: COPY_ROTATION, additive: true }),
    ]);

    expectRotation(poses.poseRotation(4), [0.12370204, 0.21425809, 0.48445645, 0.8391026]);
  });

  it('copies relative to both rests when relative, so the reference rest is taken off (`:380-388`)', () => {
    const rests = {
      2: {
        rest: transform3DFromQuaternionScale(quaternionFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.4), ONE, DOWN),
      },
      4: { rest: transform3DFromQuaternionScale(quaternionFromAxisAngle(FORWARD, 0.3), ONE, DOWN) },
    };
    const poses = edited(chain({ 2: { ...rests[2], ...POSED_B2 }, 4: rests[4] }), [setting()]);

    expectVector(poses.posePosition(4), [0.1, -0.25, 0.05]);
    expectRotation(poses.poseRotation(4), [-0.18979605, 0.058710802, 0.5533873, 0.8088838]);
    expectVector(poses.poseScale(4), [1.4999998, 0.7999999, 1.2]);
  });

  it('copies the pose of the reference bone as it is when not relative (`:483-487`)', () => {
    const rests = {
      2: {
        rest: transform3DFromQuaternionScale(quaternionFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.4), ONE, DOWN),
      },
      4: { rest: transform3DFromQuaternionScale(quaternionFromAxisAngle(FORWARD, 0.3), ONE, DOWN) },
    };
    const poses = edited(chain({ 2: { ...rests[2], ...POSED_B2 }, 4: rests[4] }), [
      setting({ relative: false }),
    ]);

    expectVector(poses.posePosition(4), [0.1, -0.25, 0.05]);
    expectRotation(poses.poseRotation(4), [0, 0, 0.4349656, 0.9004471]);
    expectVector(poses.poseScale(4), [1.5000001, 0.8, 1.2]);
  });

  describe('axis masks (`:411-451`)', () => {
    const copiedRotation = (axisFlags: number): Quaternion =>
      edited(chain({ 2: OFF_AXIS_B2 }), [setting({ copyFlags: COPY_ROTATION, axisFlags })]).poseRotation(4);

    it.each([
      ['X alone keeps the roll about X', AXIS_X, [0.18267268, 0, 0, 0.9831738]],
      ['Z alone keeps the roll about Z', AXIS_Z, [0, 0, 0.4439591, 0.89604706]],
      ['X and Y drop the roll about Z', AXIS_X | AXIS_Y, [0.024728386, 0.30687606, 0, 0.9514282]],
      ['Y and Z drop the roll about X', AXIS_Y | AXIS_Z, [0, 0.18239482, 0.4635128, 0.8671148]],
      ['Z and X drop the roll about Y', AXIS_Z | AXIS_X, [0.2762568, 0, 0.35663673, 0.8924643]],
      ['no axis leaves the identity', 0, [0, 0, 0, 1]],
    ] as const)('%s', (_name, axisFlags, expected) => {
      expectRotation(copiedRotation(axisFlags), [...expected]);
    });
  });

  it('inverts the enabled axes of position, rotation and scale (`:454-461`)', () => {
    const poses = edited(chain({ 2: { ...POSED_B2, ...OFF_AXIS_B2 } }), [
      setting({ invertFlags: AXIS_X | AXIS_Z }),
    ]);

    expectVector(poses.posePosition(4), [-0.1, -0.25, -0.05]);
    expectRotation(poses.poseRotation(4), [-0.15839815, 0.2639969, -0.42239508, 0.8525245]);
    expectVector(poses.poseScale(4), [0.6666666, 0.8, 0.8333333]);
  });

  it('inverts an axis only while that axis is enabled', () => {
    const poses = edited(chain({ 2: POSED_B2 }), [
      setting({ axisFlags: AXIS_X | AXIS_Z, invertFlags: AXIS_Y }),
    ]);

    expectVector(poses.posePosition(4), [0.1, -0.2, 0.05]);
    expectVector(poses.poseScale(4), [1.5000001, 1, 1.2]);
  });

  it('copies a share of the way by the amount (`:491`)', () => {
    const poses = edited(chain({ 2: POSED_B2 }), [setting({ amount: 0.3 })]);

    expectVector(poses.posePosition(4), [0.030000001, -0.215, 0.015000001]);
    expectRotation(poses.poseRotation(4), [0, 0, 0.13459036, 0.99090135]);
    expectVector(poses.poseScale(4), [1.1500001, 0.94000006, 1.0600001]);
  });

  it.each([
    ['an amount of zero', setting({ amount: 0 })],
    ['an amount below zero', setting({ amount: -1 })],
    ['an apply bone the skeleton lacks', setting({ applyBoneName: 'nope' })],
    ['a reference bone the skeleton lacks', setting({ referenceBoneName: 'nope' })],
    ['no apply bone at all', setting({ applyBoneName: '', applyBone: -1 })],
    ['an apply bone index past the last bone', setting({ applyBoneName: '', applyBone: 9 })],
  ])('changes nothing for %s (`bone_constraint_3d.cpp:306-318`)', (_name, skipped) => {
    const poses = edited(chain(), [skipped]);

    expectRotation(poses.poseRotation(4), [0, 0, 0, 1]);
  });

  it('finds a bone by index when the setting names none', () => {
    const poses = edited(chain(), [
      setting({
        applyBoneName: '',
        applyBone: 4,
        referenceBoneName: '',
        referenceBone: 2,
        copyFlags: COPY_ROTATION,
      }),
    ]);

    expectRotation(poses.poseRotation(4), [0, 0, 0.50000024, 0.86602527]);
  });

  it('lets a bone name win over a bone index (`:284-298`)', () => {
    const poses = edited(chain(), [setting({ applyBone: 5, copyFlags: COPY_ROTATION })]);

    expectRotation(poses.poseRotation(4), [0, 0, 0.50000024, 0.86602527]);
    expectRotation(poses.poseRotation(5), [0, 0, 0, 1]);
  });

  it('runs the settings in order, so a later one reads what an earlier one wrote', () => {
    const poses = edited(chain(), [
      setting({ copyFlags: COPY_ROTATION }),
      setting({ applyBoneName: 'b5', referenceBoneName: 'b4', copyFlags: COPY_ROTATION }),
    ]);

    expectRotation(poses.poseRotation(5), [0, 0, 0.50000024, 0.86602527]);
  });

  it('gives no modifier for one that is not active (`skeleton_modifier_3d.cpp:119-124`)', () => {
    expect(readModifier([setting()], { active: false }, NO_NODES)).toBeNull();
  });

  it('carries the influence to the skeleton, which blends with it', () => {
    expect(readModifier([setting()], { influence: 0.5 }, NO_NODES)!.influence).toBe(0.5);
  });

  describe('a reference node', () => {
    const TARGET_NAME = '../../Target';
    const turnedAboutZ = (angle: number, scale: Vector3, origin: Vector3): Transform3D => {
      const rotated = basisFromQuaternion(quaternionFromAxisAngle(FORWARD, angle));
      const rows = [0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => rotated[row * 3 + col]! * [scale.x, scale.y, scale.z][row]!)
      );
      return {
        basis_x: { x: rows[0]![0]!, y: rows[0]![1]!, z: rows[0]![2]! },
        basis_y: { x: rows[1]![0]!, y: rows[1]![1]!, z: rows[1]![2]! },
        basis_z: { x: rows[2]![0]!, y: rows[2]![1]!, z: rows[2]![2]! },
        origin,
      };
    };
    const nodeSetting = (overrides: Partial<CopyTransformSetting> = {}): CopyTransformSetting =>
      setting({ referenceType: 1, referenceNode: TARGET_NAME, referenceBoneName: '', ...overrides });

    it('copies the node in the space of the parent of the apply bone (`:381-396`)', () => {
      const root = transform3DFromQuaternionScale(quaternionFromAxisAngle(UP, 0.3), ONE, {
        x: 1,
        y: 0,
        z: 0,
      });
      const skeleton = multiplyTransform3D(
        root,
        transform3DFromQuaternionScale(quaternionFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.2), ONE, {
          x: 0,
          y: 0.2,
          z: 0,
        })
      );
      const target = multiplyTransform3D(
        root,
        turnedAboutZ(0.7, { x: 1.2, y: 0.9, z: 1.1 }, { x: 0.3, y: -0.4, z: 0.1 })
      );
      const world: ModifierWorld = {
        skeletonGlobal: skeleton,
        nodeGlobal: (path) => (path === TARGET_NAME ? target : null),
      };

      const poses = edited(chain(), [nodeSetting()], world);

      expectVector(poses.posePosition(4), [-0.42865518, -0.39389384, 0.21720825]);
      expectRotation(poses.poseRotation(4), [-0.069173634, 0.07198415, -0.23834305, 0.96603614]);
      expectVector(poses.poseScale(4), [1.0856057, 1.0351138, 1.0999999]);
    });

    it('adds the node to the pose of the apply bone when additive', () => {
      const target = turnedAboutZ(0.7, ONE, { x: 0.3, y: -0.4, z: 0.1 });
      const world: ModifierWorld = {
        skeletonGlobal: identityTransform3D(),
        nodeGlobal: (path) => (path === TARGET_NAME ? target : null),
      };

      const poses = edited(
        chain({ 4: { rotation: quaternionFromAxisAngle(UP, 0.5) } }),
        [nodeSetting({ additive: true })],
        world
      );

      expectVector(poses.posePosition(4), [-0.28301296, -0.50980747, 0.1]);
      expectRotation(poses.poseRotation(4), [-0.042733703, 0.24368533, -0.16735873, 0.95434916]);
      expectVector(poses.poseScale(4), [0.99999994, 1, 1]);
    });

    it('changes nothing for a node that does not resolve to a Node3D', () => {
      const poses = edited(chain(), [nodeSetting({ referenceNode: '../../Missing' })]);

      expectRotation(poses.poseRotation(4), [0, 0, 0, 1]);
    });

    it('changes nothing for an empty path', () => {
      const poses = edited(chain(), [nodeSetting({ referenceNode: '' })]);

      expectRotation(poses.poseRotation(4), [0, 0, 0, 1]);
    });
  });
});
