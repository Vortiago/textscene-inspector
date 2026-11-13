/**
 * The properties of SkeletonModificationStack2D and of each SkeletonModification2D class
 * (`scene/resources/2d/skeleton/`). Most are built by hand in `_get_property_list`, and a joint
 * chain stores one key for each joint and leaf.
 */

// Registers Resource, so the inherited keys resolve when this module loads alone.
import '../../resource/linterValidators.js';
import { SKELETON_MODIFICATION_2D_EXECUTION_MODE_NAMES } from '../../../godot/scene/skeletonModification2d.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../linter/validators/indexedFamily.js';
import { accepts, keyShapeError, v } from '../../../linter/validators/index.js';
import { stringToInt } from '../../../godot/string/string.js';
import { writtenIndex } from '../../../linter/reportedIndices.js';
import { layerBitmask } from '../../../linter/validators/layerBitmask.js';

validatorRegistry.registerAll('SkeletonModificationStack2D', {
  enabled: v.boolean('enabled'),
  // set_strength refuses a value below 0 and one above 1.
  strength: v.float('strength', {
    min: 0,
    max: 1,
    enforced: {
      min: 'skeleton_modification_stack_2d.cpp:232',
      max: 'skeleton_modification_stack_2d.cpp:233',
    },
  }),
  // set_modification_count refuses a negative count. The ceiling is the range hint alone.
  modification_count: v.int('modification_count', {
    min: 0,
    max: 100,
    enforced: { min: 'skeleton_modification_stack_2d.cpp:198' },
    hinted: { max: 'skeleton_modification_stack_2d.cpp:266' },
  }),
  // skeleton_modification_stack_2d.cpp:37, Variant::OBJECT for each slot.
  'modifications/*': v.resourceReference('modifications'),
});

validatorRegistry.registerAll('SkeletonModification2D', {
  enabled: v.boolean('enabled'),
  // set_execution_mode assigns (skeleton_modification_2d.cpp:189-191), so the enum hint alone bounds it.
  execution_mode: v.enumInt('execution_mode', SKELETON_MODIFICATION_2D_EXECUTION_MODE_NAMES, {
    hinted: 'skeleton_modification_2d.cpp:229',
  }),
});

/** A stored bone index, which each `set_*bone_index` refuses below 0 at `cite`. */
function boneIndex(name: string, cite: string): PropertyValidator {
  return v.int(name, { min: 0, enforced: { min: cite } });
}

/** A constraint angle in degrees: the setter assigns, and `cite` is the range hint. */
function constraintAngle(name: string, cite: string): PropertyValidator {
  return v.float(name, { min: -360, max: 360, hinted: cite });
}

validatorRegistry.registerAll('SkeletonModification2DLookAt', {
  bone_index: boneIndex('bone_index', 'skeleton_modification_2d_lookat.cpp:239'),
  bone2d_node: v.nodePath('bone2d_node'),
  target_nodepath: v.nodePath('target_nodepath'),
  enable_constraint: v.boolean('enable_constraint'),
  constraint_angle_min: constraintAngle('constraint_angle_min', 'skeleton_modification_2d_lookat.cpp:93'),
  constraint_angle_max: constraintAngle('constraint_angle_max', 'skeleton_modification_2d_lookat.cpp:94'),
  constraint_angle_invert: v.boolean('constraint_angle_invert'),
  constraint_in_localspace: v.boolean('constraint_in_localspace'),
  additional_rotation: v.float('additional_rotation'),
  'editor/draw_gizmo': v.boolean('editor/draw_gizmo'),
});

validatorRegistry.registerAll('SkeletonModification2DTwoBoneIK', {
  target_nodepath: v.nodePath('target_nodepath'),
  // set_target_minimum_distance refuses a negative distance. The ceiling is the range hint alone.
  target_minimum_distance: v.float('target_minimum_distance', {
    min: 0,
    max: 100000000,
    enforced: { min: 'skeleton_modification_2d_twoboneik.cpp:367' },
    hinted: { max: 'skeleton_modification_2d_twoboneik.cpp:492' },
  }),
  // The property states PROPERTY_HINT_NONE (:493), so only the refusal of the setter bounds it.
  target_maximum_distance: v.float('target_maximum_distance', {
    min: 0,
    enforced: { min: 'skeleton_modification_2d_twoboneik.cpp:376' },
  }),
  flip_bend_direction: v.boolean('flip_bend_direction'),
  joint_one_bone_idx: boneIndex('joint_one_bone_idx', 'skeleton_modification_2d_twoboneik.cpp:413'),
  joint_one_bone2d_node: v.nodePath('joint_one_bone2d_node'),
  joint_two_bone_idx: boneIndex('joint_two_bone_idx', 'skeleton_modification_2d_twoboneik.cpp:437'),
  joint_two_bone2d_node: v.nodePath('joint_two_bone2d_node'),
  'editor/draw_gizmo': v.boolean('editor/draw_gizmo'),
  'editor/draw_min_max': v.boolean('editor/draw_min_max'),
});

const ccdikJoint = indexedFamilyValidator({
  prefix: 'joint_data/',
  leaves: {
    bone_index: boneIndex('bone_index', 'skeleton_modification_2d_ccdik.cpp:385'),
    bone2d_node: v.nodePath('bone2d_node'),
    rotate_from_joint: v.boolean('rotate_from_joint'),
    enable_constraint: v.boolean('enable_constraint'),
    constraint_angle_min: constraintAngle('constraint_angle_min', 'skeleton_modification_2d_ccdik.cpp:136'),
    constraint_angle_max: constraintAngle('constraint_angle_max', 'skeleton_modification_2d_ccdik.cpp:137'),
    constraint_angle_invert: v.boolean('constraint_angle_invert'),
    constraint_in_localspace: v.boolean('constraint_in_localspace'),
    editor_draw_gizmo: v.boolean('editor_draw_gizmo'),
  },
  unknownCode: 'INVALID_CCDIK_JOINT_KEY',
  describes: 'CCDIK joint',
  accepts:
    'joint_data/(index)/(leaf) — bone_index, bone2d_node, rotate_from_joint, enable_constraint, constraint_angle_min, constraint_angle_max, constraint_angle_invert, constraint_in_localspace, editor_draw_gizmo',
  // `_set` reads the index with a bare `get_slicec('/', 1).to_int()` (skeleton_modification_2d_ccdik.cpp:38).
  indexParse: 'to_int',
  negativeIndex: {
    cite: 'skeleton_modification_2d_ccdik.cpp:40',
    code: 'INVALID_CCDIK_JOINT_INDEX',
    message: (index) =>
      `Joint index ${index} must be non-negative. _set fails its index check (skeleton_modification_2d_ccdik.cpp:40), so the value is never applied`,
  },
});

validatorRegistry.registerAll('SkeletonModification2DCCDIK', {
  target_nodepath: v.nodePath('target_nodepath'),
  tip_nodepath: v.nodePath('tip_nodepath'),
  // set_ccdik_data_chain_length resizes with no check of its own, so the range hint alone bounds it.
  ccdik_data_chain_length: v.int('ccdik_data_chain_length', {
    min: 0,
    max: 100,
    hinted: 'skeleton_modification_2d_ccdik.cpp:542',
  }),
  'joint_data/*': ccdikJoint,
  'editor/draw_gizmo': v.boolean('editor/draw_gizmo'),
});

const fabrikJoint = indexedFamilyValidator({
  prefix: 'joint_data/',
  leaves: {
    bone_index: boneIndex('bone_index', 'skeleton_modification_2d_fabrik.cpp:385'),
    bone2d_node: v.nodePath('bone2d_node'),
    magnet_position: v.vector2('magnet_position'),
    use_target_rotation: v.boolean('use_target_rotation'),
  },
  unknownCode: 'INVALID_FABRIK_JOINT_KEY',
  describes: 'FABRIK joint',
  accepts: 'joint_data/(index)/(leaf) — bone_index, bone2d_node, magnet_position, use_target_rotation',
  // `_set` reads the index with a bare `get_slicec('/', 1).to_int()` (skeleton_modification_2d_fabrik.cpp:38).
  indexParse: 'to_int',
  negativeIndex: {
    cite: 'skeleton_modification_2d_fabrik.cpp:40',
    code: 'INVALID_FABRIK_JOINT_INDEX',
    message: (index) =>
      `Joint index ${index} must be non-negative. _set fails its index check (skeleton_modification_2d_fabrik.cpp:40), so the value is never applied`,
  },
});

validatorRegistry.registerAll('SkeletonModification2DFABRIK', {
  target_nodepath: v.nodePath('target_nodepath'),
  // set_fabrik_data_chain_length resizes with no check of its own, so the range hint alone bounds it.
  fabrik_data_chain_length: v.int('fabrik_data_chain_length', {
    min: 0,
    max: 100,
    hinted: 'skeleton_modification_2d_fabrik.cpp:446',
  }),
  'joint_data/*': fabrikJoint,
});

validatorRegistry.registerAll('SkeletonModification2DStackHolder', {
  // skeleton_modification_2d_stackholder.cpp:71, Variant::OBJECT.
  held_modification_stack: v.resourceReference('held_modification_stack'),
  'editor/draw_gizmo': v.boolean('editor/draw_gizmo'),
});

const jiggleJoint = indexedFamilyValidator({
  prefix: 'joint_data/',
  leaves: {
    bone_index: boneIndex('bone_index', 'skeleton_modification_2d_jiggle.cpp:421'),
    bone2d_node: v.nodePath('bone2d_node'),
    override_defaults: v.boolean('override_defaults'),
    // set_jiggle_joint_stiffness refuses a negative value. The ceiling is the range hint alone.
    stiffness: v.float('stiffness', {
      min: 0,
      max: 1000,
      enforced: { min: 'skeleton_modification_2d_jiggle.cpp:458' },
      hinted: { max: 'skeleton_modification_2d_jiggle.cpp:124' },
    }),
    // The hint starts at 0.001 and is open above. set_jiggle_joint_mass refuses only below 0 (:469).
    mass: v.float('mass', {
      min: 0.001,
      hinted: { min: 'skeleton_modification_2d_jiggle.cpp:125' },
      enforcedMin: { at: 0 },
    }),
    // set_jiggle_joint_damping refuses only a negative value. The ceiling is the range hint alone.
    damping: v.float('damping', {
      min: 0,
      max: 1,
      enforced: { min: 'skeleton_modification_2d_jiggle.cpp:480' },
      hinted: { max: 'skeleton_modification_2d_jiggle.cpp:126' },
    }),
    use_gravity: v.boolean('use_gravity'),
    gravity: v.vector2('gravity'),
  },
  unknownCode: 'INVALID_JIGGLE_JOINT_KEY',
  describes: 'Jiggle joint',
  accepts:
    'joint_data/(index)/(leaf) — bone_index, bone2d_node, override_defaults, stiffness, mass, damping, use_gravity, gravity',
  // `_set` reads the index with a bare `get_slicec('/', 1).to_int()` (skeleton_modification_2d_jiggle.cpp:40).
  indexParse: 'to_int',
  negativeIndex: {
    cite: 'skeleton_modification_2d_jiggle.cpp:42',
    code: 'INVALID_JIGGLE_JOINT_INDEX',
    message: (index) =>
      `Joint index ${index} must be non-negative. _set fails its index check (skeleton_modification_2d_jiggle.cpp:42), so the value is never applied`,
  },
});

validatorRegistry.registerAll('SkeletonModification2DJiggle', {
  target_nodepath: v.nodePath('target_nodepath'),
  // set_jiggle_data_chain_length refuses a negative length. The ceiling is the range hint alone.
  jiggle_data_chain_length: v.int('jiggle_data_chain_length', {
    min: 0,
    max: 100,
    enforced: { min: 'skeleton_modification_2d_jiggle.cpp:401' },
    hinted: { max: 'skeleton_modification_2d_jiggle.cpp:553' },
  }),
  stiffness: v.float('stiffness', { min: 0, enforced: { min: 'skeleton_modification_2d_jiggle.cpp:330' } }),
  mass: v.float('mass', { min: 0, enforced: { min: 'skeleton_modification_2d_jiggle.cpp:340' } }),
  damping: v.float('damping', {
    min: 0,
    max: 1,
    enforced: {
      min: 'skeleton_modification_2d_jiggle.cpp:350',
      max: 'skeleton_modification_2d_jiggle.cpp:351',
    },
  }),
  use_gravity: v.boolean('use_gravity'),
  gravity: v.vector2('gravity'),
  use_colliders: v.boolean('use_colliders'),
  collision_mask: layerBitmask('collision_mask', {
    hinted: 'skeleton_modification_2d_jiggle.cpp:113',
    width: 'int32' /* skeleton_modification_2d_jiggle.h:110 */,
  }),
  'joint_data/*': jiggleJoint,
});

const physicalBoneNode = v.nodePath('joint_nodepath');

/**
 * `joint_<i>_nodepath`: `_set` reads the index with `get_slicec('_', 1).to_int()` and the leaf with
 * `get_slicec('_', 2)` (skeleton_modification_2d_physicalbones.cpp:52-53). It refuses a negative
 * index (:54) and returns false for a leaf other than `nodepath` (:56-61), so neither is stored.
 */
const physicalBoneJoint: PropertyValidator = accepts((key, value, line) => {
  const [, index = '', leaf] = key.split('_');
  if (leaf !== 'nodepath') {
    return keyShapeError(
      key,
      line,
      `Unknown PhysicalBones joint property: "${key}"`,
      'INVALID_PHYSICALBONES_JOINT_KEY'
    );
  }
  const jointIndex = stringToInt(index);
  if (jointIndex < 0) {
    return keyShapeError(
      key,
      line,
      `Joint index ${writtenIndex(index, jointIndex)} must be non-negative. _set fails its index check (skeleton_modification_2d_physicalbones.cpp:54), so the value is never applied`,
      'INVALID_PHYSICALBONES_JOINT_INDEX'
    );
  }
  return physicalBoneNode(key, value, line);
}, 'joint_(index)_nodepath = NodePath("...")');
physicalBoneJoint.grounding = { kind: 'enforced', cite: 'skeleton_modification_2d_physicalbones.cpp:54' };
physicalBoneJoint.leaves = [physicalBoneNode];

validatorRegistry.registerAll('SkeletonModification2DPhysicalBones', {
  // set_physical_bone_chain_length refuses a negative length. The ceiling is the range hint alone.
  physical_bone_chain_length: v.int('physical_bone_chain_length', {
    min: 0,
    max: 100,
    enforced: { min: 'skeleton_modification_2d_physicalbones.cpp:183' },
    hinted: { max: 'skeleton_modification_2d_physicalbones.cpp:286' },
  }),
  fetch_bones: v.boolean('fetch_bones'),
  // The terminal-index routing shape: a joint key has no `/` (skeleton_modification_2d_physicalbones.cpp:97-99).
  'joint_#': physicalBoneJoint,
});
