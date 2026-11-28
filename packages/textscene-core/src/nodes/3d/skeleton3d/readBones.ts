/**
 * The bone table of a Skeleton3D, read from its `bones/<i>/<leaf>` keys the way `Skeleton3D::_set`
 * applies them (`skeleton_3d.cpp:80-135`): in file order, a name at the next index adds a bone, and
 * any other key sets a leaf of a bone that is already there.
 */

import { propertyWrites } from '../../../parser/overridePropertyWrites.js';
import { warn } from '../../../logger.js';
import { boolOr, intOr, realVec3Or } from '../../../parser/valueParsers.js';
import { parseQuaternion } from '../../../parser/vectors.js';
import { parseTransform3D } from '../../../utils/transform.js';
import { boneKeyOf, BoneAdder } from './boneTable.js';
import { newBone, type Bone } from './skeletonPose.js';

/** Writes `value` to a leaf of `bone`, which is slot `which`. Only `parent` reads the slot. */
type LeafSetter = (bone: Bone, value: string, context: string, which: number) => void;

/** `read` of `value`, or `kept` with a warning when the literal is malformed. */
function literalOr<T>(read: (literal: string) => T, value: string, kept: T, context: string): T {
  try {
    return read(value);
  } catch (error) {
    warn(`${context}: ${error instanceof Error ? error.message : String(error)}, keeping the previous value`);
    return kept;
  }
}

/**
 * Each leaf `_set` has an arm for, bar `name` (an add) and `bone_meta`, which nothing here reads.
 * The 3.x `pose` and `bound_children` have no arm: no 4.x bone state comes from them here.
 */
const LEAF_SETTERS: Readonly<Record<string, LeafSetter>> = {
  // `set_bone_parent` refuses a parent below -1 and a bone as its own parent (:721-722). A parent
  // past the last bone is stored, and the pose model reads it as none (`_update_process_order`).
  parent: (bone, value, context, which) => {
    const parent = intOr(value, bone.parent, context);
    if (parent >= -1 && parent !== which) bone.parent = parent;
  },
  rest: (bone, value, context) => {
    bone.rest = literalOr(parseTransform3D, value, bone.rest, context);
  },
  enabled: (bone, value, context) => {
    bone.enabled = boolOr(value, bone.enabled, context);
  },
  position: (bone, value, context) => {
    bone.position = realVec3Or(value, bone.position, context);
  },
  rotation: (bone, value, context) => {
    bone.rotation = literalOr(parseQuaternion, value, bone.rotation, context);
  },
  scale: (bone, value, context) => {
    bone.scale = realVec3Or(value, bone.scale, context);
  },
};

export interface BoneChange {
  index: number;
  change: Partial<Bone>;
}

export function readBones(
  properties: Record<string, string>,
  held: readonly Bone[] = [],
  changes?: BoneChange[]
): Bone[] {
  const bones = [...held];
  const adder = new BoneAdder(held.map((bone) => bone.name));
  for (const [key, value] of propertyWrites(properties)) {
    const addition = adder.write(key, value);
    if (addition) {
      if (addition.kind === 'added') {
        const bone = newBone(addition.name);
        changes?.push({ index: bones.length, change: bone });
        bones.push(bone);
      }
      continue;
    }
    const slot = boneKeyOf(key);
    if (!slot) continue;
    const { which, leaf } = slot;
    const bone = bones[which];
    if (!bone || !Object.hasOwn(LEAF_SETTERS, leaf)) continue;
    const next = changes ? { ...bone } : bone;
    LEAF_SETTERS[leaf]!(next, value, `Skeleton3D ${key}`, which);
    bones[which] = next;
    changes?.push({ index: which, change: { [leaf]: next[leaf as keyof Bone] } });
  }
  return bones;
}
