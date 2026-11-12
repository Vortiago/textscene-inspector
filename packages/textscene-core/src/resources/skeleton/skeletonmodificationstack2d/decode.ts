/**
 * SkeletonModificationStack2D decode: a stack, and each modification its `modifications/<i>` slots
 * name, as their `_set` methods read the property bags (`skeleton_modification_stack_2d.cpp:44-53`
 * and the `_set` of each `skeleton_modification_2d_*.cpp`).
 */

import { declaredLeafResolver, indexedElements } from '../../../godot/classdb/indexedKey.js';
import { degToRadf, TAU } from '../../../godot/math/math.js';
import type { Vector2 } from '../../../godot/math/vector.js';
import { stringToInt } from '../../../godot/string/string.js';
import { SkeletonModification2DExecutionMode } from '../../../godot/scene/skeletonModification2d.js';
import { slotCount } from '../../../godot/variant/intSlots.js';
import { nodePathLiteral } from '../../../godot/variant/variantParser.js';
import { boolOr, floatOr, intOr, realOr, realVec2Or } from '../../../parser/valueParsers';
import type { Follow, ResourceKind } from '../../reading';
import type {
  AngleConstraint,
  BoneReference,
  CCDIKJoint2D,
  FABRIKJoint2D,
  Modification2D,
  ModificationStack2D,
} from './types';

const STACK_TYPE = 'SkeletonModificationStack2D';

const MODIFICATION_TYPES: ReadonlySet<string> = new Set([
  'SkeletonModification2DLookAt',
  'SkeletonModification2DTwoBoneIK',
  'SkeletonModification2DCCDIK',
  'SkeletonModification2DFABRIK',
  'SkeletonModification2DStackHolder',
  'SkeletonModification2DJiggle',
  'SkeletonModification2DPhysicalBones',
]);

/**
 * A stack with the modifications it holds, from any origin. A modification this does not read
 * leaves its slot null, and a StackHolder that holds a stack on the way to itself holds nothing.
 */
export const MODIFICATION_STACK: ResourceKind<ModificationStack2D> = {
  name: STACK_TYPE,
  accepts: (type) => type === STACK_TYPE,
  decode: ({ properties }, follow) => stackOf(properties, follow),
};

/** One modification of a stack, as its `_set` reads the property bag. */
const MODIFICATION: ResourceKind<Modification2D> = {
  name: 'SkeletonModification2D',
  accepts: (type) => MODIFICATION_TYPES.has(type),
  decode: ({ type, properties }, follow) => modificationOf(type, properties, follow),
};

function stackOf(data: Readonly<Record<string, string>>, follow: Follow): ModificationStack2D {
  // `set_modification_count` refuses a negative count (`skeleton_modification_stack_2d.cpp:198`),
  // and `set_modification` an index at or past it (`:183`).
  const stored = storedSlots(data);
  const slots = filledSlots(slotCount(data.modification_count) ?? 0, stored.keys());
  return {
    enabled: boolOr(data.enabled, false),
    strength: strengthOf(data.strength),
    modifications: slots.map((index) =>
      index === null ? null : follow.read(MODIFICATION, stored.get(index)).value
    ),
  };
}

const SLOT_PREFIX = 'modifications/';

/**
 * The reference each `modifications/<i>` key stores, by the slot `_set` writes it to:
 * `get_slicec('/', 1).to_int()` (`skeleton_modification_stack_2d.cpp:47-49`). A later key of one
 * slot replaces an earlier one.
 */
function storedSlots(data: Readonly<Record<string, string>>): Map<number, string> {
  const stored = new Map<number, string>();
  for (const key of Object.keys(data)) {
    if (key.startsWith(SLOT_PREFIX)) stored.set(stringToInt(key.split('/')[1]!), data[key]!);
  }
  return stored;
}

/**
 * The slots below `count`, in order: the index of each one of `stored`, and one null for each run
 * of slots the file does not store. Each of those holds the default, and one default slot solves as
 * any number of them do. A count of 2000000000 would allocate every slot.
 */
function filledSlots(count: number, stored: Iterable<number>): (number | null)[] {
  const slots: (number | null)[] = [];
  let next = 0;
  for (const index of [...new Set(stored)].sort((a, b) => a - b)) {
    // A setter refuses a negative index, as it refuses one at or past the count.
    if (index < 0) continue;
    if (index >= count) break;
    if (index > next) slots.push(null);
    slots.push(index);
    next = index + 1;
  }
  if (next < count) slots.push(null);
  return slots;
}

/** `float strength = 1.0` (`skeleton_modification_stack_2d.h:58`). */
const DEFAULT_STRENGTH = 1;

/**
 * `set_strength` refuses a strength below 0 or above 1 (`skeleton_modification_stack_2d.cpp:232-233`),
 * so the stack keeps its default. A NaN passes both tests, and holds no bone.
 */
function strengthOf(raw: string | undefined): number {
  const strength = realOr(raw, DEFAULT_STRENGTH);
  return strength < 0 || strength > 1 ? DEFAULT_STRENGTH : strength;
}

function modificationOf(
  type: string,
  data: Readonly<Record<string, string>>,
  follow: Follow
): Modification2D | null {
  const base = {
    enabled: boolOr(data.enabled, true),
    executionMode: intOr(data.execution_mode, SkeletonModification2DExecutionMode.PROCESS),
  };
  switch (type) {
    case 'SkeletonModification2DLookAt':
      return {
        ...base,
        type,
        bone: { index: intOr(data.bone_index, -1), node: pathOf(data.bone2d_node) },
        target: pathOf(data.target_nodepath),
        additionalRotation: degrees(data.additional_rotation, 0),
        constraint: constraintOf((leaf) => data[leaf]),
      };
    case 'SkeletonModification2DTwoBoneIK':
      return {
        ...base,
        type,
        target: pathOf(data.target_nodepath),
        targetMinimumDistance: realOr(data.target_minimum_distance, 0),
        targetMaximumDistance: realOr(data.target_maximum_distance, 0),
        flipBendDirection: boolOr(data.flip_bend_direction, false),
        jointOne: { index: intOr(data.joint_one_bone_idx, -1), node: pathOf(data.joint_one_bone2d_node) },
        jointTwo: { index: intOr(data.joint_two_bone_idx, -1), node: pathOf(data.joint_two_bone2d_node) },
      };
    case 'SkeletonModification2DCCDIK':
      return {
        ...base,
        type,
        target: pathOf(data.target_nodepath),
        tip: pathOf(data.tip_nodepath),
        joints: jointsOf(data, 'ccdik_data_chain_length', CCDIK_LEAF, ccdikJointOf),
      };
    case 'SkeletonModification2DFABRIK':
      return {
        ...base,
        type,
        target: pathOf(data.target_nodepath),
        joints: jointsOf(data, 'fabrik_data_chain_length', FABRIK_LEAF, fabrikJointOf),
      };
    case 'SkeletonModification2DStackHolder':
      return {
        ...base,
        type,
        heldStack: follow.read(MODIFICATION_STACK, data.held_modification_stack).value,
      };
    case 'SkeletonModification2DJiggle':
    case 'SkeletonModification2DPhysicalBones':
      return { ...base, type };
    default:
      return null;
  }
}

/**
 * The NodePath literal as the file wrote it, or undefined for none and for an empty one: an empty
 * path names no node, and `is_empty` decides whether a joint waits for its bone cache.
 */
function pathOf(raw: string | undefined): string | undefined {
  return raw !== undefined && nodePathLiteral(raw)?.trim() === '' ? undefined : raw;
}

/** A value by its leaf name, or undefined where the file wrote none. */
type Leaves = (leaf: string) => string | undefined;

/**
 * `_set` reads the joint with `get_slicec('/', 1).to_int()` and the leaf with `get_slicec('/', 2)`
 * (`skeleton_modification_2d_ccdik.cpp:37-38`, `skeleton_modification_2d_fabrik.cpp:37-38`), so a
 * tail below the leaf is ignored.
 */
const CCDIK_LEAF = declaredLeafResolver([
  'bone2d_node',
  'bone_index',
  'rotate_from_joint',
  'enable_constraint',
  'constraint_angle_min',
  'constraint_angle_max',
  'constraint_angle_invert',
  'constraint_in_localspace',
]);
const FABRIK_LEAF = declaredLeafResolver([
  'bone2d_node',
  'bone_index',
  'magnet_position',
  'use_target_rotation',
]);

/**
 * One joint for each of the chain length at `lengthKey`. A joint at or past the length is dropped,
 * as `_set` fails `ERR_FAIL_INDEX_V` for it, and a negative length leaves no joint.
 */
function jointsOf<Joint>(
  data: Readonly<Record<string, string>>,
  lengthKey: string,
  leafResolver: ReturnType<typeof declaredLeafResolver>,
  jointOf: (leaves: Leaves) => Joint
): Joint[] {
  const written = indexedElements(data, 'joint_data/', 'to_int', leafResolver);
  const slots = filledSlots(slotCount(data[lengthKey]) ?? 0, written.keys());
  return slots.map((index) =>
    jointOf((leaf) => (index === null ? undefined : written.get(index)?.get(leaf)))
  );
}

function boneOf(leaves: Leaves): BoneReference {
  return { index: intOr(leaves('bone_index'), -1), node: pathOf(leaves('bone2d_node')) };
}

function ccdikJointOf(leaves: Leaves): CCDIKJoint2D {
  return {
    bone: boneOf(leaves),
    rotateFromJoint: boolOr(leaves('rotate_from_joint'), false),
    constraint: constraintOf(leaves),
  };
}

const NO_MAGNET: Vector2 = { x: 0, y: 0 };

function fabrikJointOf(leaves: Leaves): FABRIKJoint2D {
  return {
    bone: boneOf(leaves),
    magnetPosition: realVec2Or(leaves('magnet_position'), NO_MAGNET),
    useTargetRotation: boolOr(leaves('use_target_rotation'), false),
  };
}

/**
 * The angle limit of a LookAt or of a CCDIK joint, at the defaults of
 * `skeleton_modification_2d_lookat.h:53-57` and `skeleton_modification_2d_ccdik.h:50-54`.
 */
function constraintOf(leaves: Leaves): AngleConstraint {
  return {
    enabled: boolOr(leaves('enable_constraint'), false),
    min: degrees(leaves('constraint_angle_min'), 0),
    max: degrees(leaves('constraint_angle_max'), TAU),
    invert: boolOr(leaves('constraint_angle_invert'), false),
    inLocalSpace: boolOr(leaves('constraint_in_localspace'), true),
  };
}

/** A file stores an angle in degrees, and `_set` converts it with the float `deg_to_rad`. */
function degrees(raw: string | undefined, fallbackRadians: number): number {
  return raw === undefined ? fallbackRadians : degToRadf(floatOr(raw, 0));
}
