/**
 * The bone table of a Skeleton3D, read from its `bones/<i>/<leaf>` keys the way `Skeleton3D::_set`
 * applies them (`skeleton_3d.cpp:80-135`): in file order, a name at the next index adds a bone, and
 * any other key sets a leaf of a bone that is already there.
 */

import { firstSegment } from '../../../godot/classdb/indexedKey.js';
import { stringToInt } from '../../../godot/string/string.js';
import { warn } from '../../../logger.js';
import { boolOr, intOr, realVec3Or } from '../../../parser/valueParsers.js';
import { parseQuaternion } from '../../../parser/vectors.js';
import { parseTransform3D } from '../../../utils/transform.js';
import { BONE_KEY_RE, BoneAdder } from './boneTable.js';
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

/** The bones a node's `bones/*` keys build, in the order `add_bone` added them. */
export function readBones(properties: Record<string, string>): Bone[] {
  const bones: Bone[] = [];
  const adder = new BoneAdder();
  for (const [key, value] of Object.entries(properties)) {
    const addition = adder.write(key, value);
    if (addition) {
      if (addition.kind === 'added') bones.push(newBone(addition.name));
      continue;
    }
    setLeaf(bones, key, value);
  }
  return bones;
}

/** A leaf key of a bone that exists. `which` is a `uint32_t`, so an index past the table drops the write (:90). */
function setLeaf(bones: Bone[], key: string, value: string): void {
  const match = BONE_KEY_RE.exec(key);
  if (!match) return;
  const which = stringToInt(match[1]!, 'uint32');
  const bone = bones[which];
  // Slice 2 alone decides the arm (:83), so `bones/0/position/x` sets the position.
  const leaf = firstSegment(match[2]!);
  const setter = Object.hasOwn(LEAF_SETTERS, leaf) ? LEAF_SETTERS[leaf] : undefined;
  if (bone && setter) setter(bone, value, `Skeleton3D ${key}`, which);
}
