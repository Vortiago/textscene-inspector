/**
 * The pose model of a Skeleton3D: its bone table, and the automatic skin Godot derives from it. A
 * bone writes a rest and a pose, and a MeshInstance3D without a `skin` binds to the skin the
 * skeleton makes of them. THREE-free, so the parser, the scene pass and the tests all read it.
 */

import {
  affineInverseTransform3D,
  identityTransform3D,
  multiplyTransform3D,
  transform3DFromQuaternionScale,
  type Transform3D,
} from '../../../godot/math/transform3d.js';
import type { Quaternion } from '../../../godot/math/quaternion.js';
import type { Vector3 } from '../../../godot/math/vector.js';

/** One entry of `bones/<i>/…` (`skeleton_3d.h:105-113`). */
export interface Bone {
  name: string;
  /** The index of the parent bone, or -1 for none. An index past the last bone also means none. */
  parent: number;
  rest: Transform3D;
  enabled: boolean;
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
}

/** A bone as `add_bone` makes it (`skeleton_3d.cpp:603-619`): enabled, at the identity pose. */
export function newBone(name: string): Bone {
  return {
    name,
    parent: -1,
    rest: identityTransform3D(),
    enabled: true,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  };
}

/**
 * The matrix that moves a vertex bound to each bone of the automatic skin from its rest to its
 * pose: the global pose times the inverse of the global rest (`skeleton_3d.cpp:398-403, 1014`),
 * one entry per bone in table order.
 *
 * `show_rest_only` poses every bone at its rest (`:1104`), as does a disabled bone. A bone that no
 * root reaches, which only a parent cycle makes, keeps the identity Godot allocates for it.
 *
 * @canonical The automatic skin of a Skeleton3D's bones
 */
export function automaticSkinMatrices(bones: readonly Bone[], showRestOnly: boolean): Transform3D[] {
  const globalRests = bones.map(identityTransform3D);
  const globalPoses = bones.map(identityTransform3D);
  for (const index of boneOrder(bones)) {
    const bone = bones[index]!;
    const parent = parentOf(bone, bones.length);
    const isPosed = bone.enabled && !showRestOnly;
    globalRests[index] = standOn(parent < 0 ? null : globalRests[parent]!, bone.rest);
    globalPoses[index] = standOn(
      parent < 0 ? null : globalPoses[parent]!,
      isPosed ? poseOf(bone) : bone.rest
    );
  }
  return globalPoses.map((pose, i) => multiplyTransform3D(pose, affineInverseTransform3D(globalRests[i]!)));
}

/** `Bone::update_pose_cache` (`skeleton_3d.h:118-124`). */
function poseOf({ rotation, scale, position }: Bone): Transform3D {
  return transform3DFromQuaternionScale(rotation, scale, position);
}

/** `local` under `parentGlobal`, or on the identity for a bone with no parent. */
function standOn(parentGlobal: Transform3D | null, local: Transform3D): Transform3D {
  return parentGlobal ? multiplyTransform3D(parentGlobal, local) : local;
}

/** `_update_process_order` (`:223-226`) turns a parent past the last bone into none. */
function parentOf(bone: Bone, boneCount: number): number {
  return bone.parent >= boneCount ? -1 : bone.parent;
}

/** The bone indices with every parent before its children: each root, then its subtree. */
function boneOrder(bones: readonly Bone[]): number[] {
  const children = new Map<number, number[]>();
  bones.forEach((bone, index) => {
    const parent = parentOf(bone, bones.length);
    const siblings = children.get(parent);
    if (siblings) siblings.push(index);
    else children.set(parent, [index]);
  });
  const order: number[] = [];
  const pending = (children.get(-1) ?? []).slice().reverse();
  for (let index = pending.pop(); index !== undefined; index = pending.pop()) {
    order.push(index);
    pending.push(...(children.get(index) ?? []).slice().reverse());
  }
  return order;
}
