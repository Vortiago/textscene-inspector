/**
 * The properties of SkeletonModificationStack2D and of each SkeletonModification2D class, as
 * `scene/resources/2d/skeleton/` binds and refuses them.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import './linterValidators';

/** Runs the validator `type` registers for `key`, or fails where none resolves. */
function check(type: string, key: string, value: string) {
  const validator = validatorRegistry.findValidator(type, key);
  expect(validator, `no validator for ${type}.${key}`).not.toBeNull();
  return validator!(key, value, 1);
}

describe('SkeletonModificationStack2D properties', () => {
  const stack = (key: string, value: string) => check('SkeletonModificationStack2D', key, value);

  it('takes the values Godot writes', () => {
    expect(stack('enabled', 'true')).toBeNull();
    expect(stack('strength', '0.5')).toBeNull();
    expect(stack('modification_count', '2')).toBeNull();
    expect(stack('modifications/0', 'SubResource("look")')).toBeNull();
  });

  it('errors on a strength outside 0 to 1, which set_strength refuses', () => {
    expect(stack('strength', '-0.25')).toBeAtTier('error');
    expect(stack('strength', '1.5')).toBeAtTier('error');
  });

  it('errors on a negative modification_count and warns past the hint of 100', () => {
    expect(stack('modification_count', '-1')).toBeAtTier('error');
    expect(stack('modification_count', '101')).toBeAtTier('warning');
  });

  it('rejects a modification slot that holds no reference', () => {
    expect(stack('modifications/0', '3')).toBeAtTier('error');
  });
});

describe('SkeletonModification2D properties', () => {
  it('reach every modification class through the base', () => {
    expect(check('SkeletonModification2DFABRIK', 'enabled', 'false')).toBeNull();
    expect(check('SkeletonModification2DFABRIK', 'execution_mode', '1')).toBeNull();
  });

  it('warn on an execution_mode outside the enum hint, which the setter stores', () => {
    expect(check('SkeletonModification2DLookAt', 'execution_mode', '2')).toBeAtTier('warning');
  });

  it('reject a value the property cannot hold', () => {
    expect(check('SkeletonModification2DLookAt', 'enabled', '"yes"')).toBeAtTier('error');
  });
});

describe('SkeletonModification2DLookAt properties', () => {
  const lookAt = (key: string, value: string) => check('SkeletonModification2DLookAt', key, value);

  it('takes the values Godot writes', () => {
    expect(lookAt('bone_index', '0')).toBeNull();
    expect(lookAt('bone2d_node', 'NodePath("Arm")')).toBeNull();
    expect(lookAt('target_nodepath', 'NodePath("../Target")')).toBeNull();
    expect(lookAt('enable_constraint', 'true')).toBeNull();
    expect(lookAt('constraint_angle_min', '-45.0')).toBeNull();
    expect(lookAt('constraint_angle_invert', 'false')).toBeNull();
    expect(lookAt('constraint_in_localspace', 'false')).toBeNull();
    expect(lookAt('additional_rotation', '1.5707964')).toBeNull();
    expect(lookAt('editor/draw_gizmo', 'true')).toBeNull();
  });

  it('errors on a negative bone_index, which set_bone_index refuses', () => {
    expect(lookAt('bone_index', '-1')).toBeAtTier('error');
  });

  it('warns on a constraint angle outside the hint of -360 to 360', () => {
    expect(lookAt('constraint_angle_max', '400.0')).toBeAtTier('warning');
  });
});

describe('SkeletonModification2DTwoBoneIK properties', () => {
  const twoBone = (key: string, value: string) => check('SkeletonModification2DTwoBoneIK', key, value);

  it('takes the values Godot writes', () => {
    expect(twoBone('target_nodepath', 'NodePath("../Target")')).toBeNull();
    expect(twoBone('target_minimum_distance', '10.0')).toBeNull();
    expect(twoBone('target_maximum_distance', '200.0')).toBeNull();
    expect(twoBone('flip_bend_direction', 'true')).toBeNull();
    expect(twoBone('joint_one_bone_idx', '0')).toBeNull();
    expect(twoBone('joint_two_bone2d_node', 'NodePath("A/B")')).toBeNull();
    expect(twoBone('editor/draw_min_max', 'false')).toBeNull();
  });

  it('errors on a negative distance and a negative joint index, which the setters refuse', () => {
    expect(twoBone('target_minimum_distance', '-1.0')).toBeAtTier('error');
    expect(twoBone('target_maximum_distance', '-1.0')).toBeAtTier('error');
    expect(twoBone('joint_one_bone_idx', '-1')).toBeAtTier('error');
    expect(twoBone('joint_two_bone_idx', '-1')).toBeAtTier('error');
  });

  it('warns on a minimum distance past its range hint, and takes any maximum, which states no hint', () => {
    expect(twoBone('target_minimum_distance', '200000000.0')).toBeAtTier('warning');
    expect(twoBone('target_maximum_distance', '200000000.0')).toBeNull();
  });
});

describe('SkeletonModification2DCCDIK properties', () => {
  const ccdik = (key: string, value: string) => check('SkeletonModification2DCCDIK', key, value);

  it('takes the values Godot writes', () => {
    expect(ccdik('target_nodepath', 'NodePath("../Target")')).toBeNull();
    expect(ccdik('tip_nodepath', 'NodePath("A/B/Tip")')).toBeNull();
    expect(ccdik('ccdik_data_chain_length', '3')).toBeNull();
    expect(ccdik('joint_data/0/bone_index', '0')).toBeNull();
    expect(ccdik('joint_data/0/bone2d_node', 'NodePath("A")')).toBeNull();
    expect(ccdik('joint_data/1/rotate_from_joint', 'true')).toBeNull();
    expect(ccdik('joint_data/1/constraint_angle_min', '-30.0')).toBeNull();
    expect(ccdik('joint_data/1/editor_draw_gizmo', 'true')).toBeNull();
  });

  it('warns on a chain length outside the hint of 0 to 100, which the setter does not check', () => {
    expect(ccdik('ccdik_data_chain_length', '101')).toBeAtTier('warning');
  });

  it('errors on a negative joint index, a negative bone index and a leaf `_set` does not know', () => {
    expect(ccdik('joint_data/-1/bone_index', '0')).toBeAtTier('error');
    expect(ccdik('joint_data/0/bone_index', '-1')).toBeAtTier('error');
    expect(ccdik('joint_data/0/magnet_position', 'Vector2(0, 0)')).toBeAtTier('error');
  });
});

describe('SkeletonModification2DFABRIK properties', () => {
  const fabrik = (key: string, value: string) => check('SkeletonModification2DFABRIK', key, value);

  it('takes the values Godot writes', () => {
    expect(fabrik('target_nodepath', 'NodePath("../Target")')).toBeNull();
    expect(fabrik('fabrik_data_chain_length', '3')).toBeNull();
    expect(fabrik('joint_data/0/bone_index', '0')).toBeNull();
    expect(fabrik('joint_data/1/magnet_position', 'Vector2(0, -40)')).toBeNull();
    expect(fabrik('joint_data/2/use_target_rotation', 'true')).toBeNull();
  });

  it('rejects a magnet position that is no Vector2', () => {
    expect(fabrik('joint_data/1/magnet_position', '4')).toBeAtTier('error');
  });

  it('errors on a negative joint index and on a CCDIK leaf', () => {
    expect(fabrik('joint_data/-1/bone_index', '0')).toBeAtTier('error');
    expect(fabrik('joint_data/0/rotate_from_joint', 'true')).toBeAtTier('error');
  });
});

describe('SkeletonModification2DStackHolder properties', () => {
  const holder = (key: string, value: string) => check('SkeletonModification2DStackHolder', key, value);

  it('takes a reference to the held stack', () => {
    expect(holder('held_modification_stack', 'SubResource("held")')).toBeNull();
  });

  it('rejects a held stack that is no reference', () => {
    expect(holder('held_modification_stack', '"held"')).toBeAtTier('error');
  });

  it('takes the editor gizmo flag (edge case)', () => {
    expect(holder('editor/draw_gizmo', 'false')).toBeNull();
  });
});

describe('SkeletonModification2DJiggle properties', () => {
  const jiggle = (key: string, value: string) => check('SkeletonModification2DJiggle', key, value);

  it('takes the values Godot writes', () => {
    expect(jiggle('target_nodepath', 'NodePath("../Target")')).toBeNull();
    expect(jiggle('jiggle_data_chain_length', '2')).toBeNull();
    expect(jiggle('stiffness', '3.0')).toBeNull();
    expect(jiggle('mass', '0.75')).toBeNull();
    expect(jiggle('damping', '0.75')).toBeNull();
    expect(jiggle('use_gravity', 'true')).toBeNull();
    expect(jiggle('gravity', 'Vector2(0, 6)')).toBeNull();
    expect(jiggle('use_colliders', 'true')).toBeNull();
    expect(jiggle('collision_mask', '-1')).toBeNull();
    expect(jiggle('joint_data/0/override_defaults', 'true')).toBeNull();
    expect(jiggle('joint_data/0/gravity', 'Vector2(0, 6)')).toBeNull();
  });

  it('errors on what the setters refuse: a negative length, stiffness or mass, and a damping outside 0 to 1', () => {
    expect(jiggle('jiggle_data_chain_length', '-1')).toBeAtTier('error');
    expect(jiggle('stiffness', '-1.0')).toBeAtTier('error');
    expect(jiggle('mass', '-1.0')).toBeAtTier('error');
    expect(jiggle('damping', '-0.1')).toBeAtTier('error');
    expect(jiggle('damping', '1.1')).toBeAtTier('error');
  });

  it('holds a joint to its own setters: only a negative value errors, and the hint warns', () => {
    expect(jiggle('joint_data/0/damping', '-0.1')).toBeAtTier('error');
    expect(jiggle('joint_data/0/damping', '1.1')).toBeAtTier('warning');
    expect(jiggle('joint_data/0/stiffness', '1001.0')).toBeAtTier('warning');
    expect(jiggle('joint_data/0/mass', '0.0005')).toBeAtTier('warning');
    expect(jiggle('joint_data/0/mass', '-1.0')).toBeAtTier('error');
    expect(jiggle('joint_data/-1/mass', '1.0')).toBeAtTier('error');
  });
});

describe('SkeletonModification2DPhysicalBones properties', () => {
  const bones = (key: string, value: string) => check('SkeletonModification2DPhysicalBones', key, value);

  it('takes the values Godot writes', () => {
    expect(bones('physical_bone_chain_length', '2')).toBeNull();
    expect(bones('joint_0_nodepath', 'NodePath("A/Physical")')).toBeNull();
    expect(bones('fetch_bones', 'false')).toBeNull();
  });

  it('errors on a negative chain length and warns past the hint of 100', () => {
    expect(bones('physical_bone_chain_length', '-1')).toBeAtTier('error');
    expect(bones('physical_bone_chain_length', '101')).toBeAtTier('warning');
  });

  it('rejects a joint path that is no NodePath', () => {
    expect(bones('joint_0_nodepath', '3')).toBeAtTier('error');
  });

  it('errors on a joint key Godot drops: a leaf other than nodepath, and a negative index', () => {
    expect(bones('joint_0_bone', 'NodePath("A")')).toBeAtTier('error');
    expect(bones('joint_-1_nodepath', 'NodePath("A")')).toBeAtTier('error');
  });
});
