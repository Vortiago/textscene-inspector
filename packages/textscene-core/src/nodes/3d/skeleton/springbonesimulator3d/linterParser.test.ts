/**
 * SpringBoneSimulator3D strict validators: format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing. Rule-level behaviour belongs in linter.test.ts.
 *
 * The load-bearing case is `RESOLVABLE_KEYS`: every key of the family, asserted
 * to reach a validator AND to be accepted. Most of the rows are the two complete
 * property sets Godot 4.6.3's own serialiser emits for a SpringBoneSimulator3D,
 * one per config mode; the four marked below are constructed, because the engine
 * hides those keys in whichever state the rest of the table is in. The rows are
 * therefore a single `settings/0` carrying both modes at once, which is a
 * combination Godot never writes and a validator must still accept key by key.
 *
 * It is the leaf set's real check: the fixture can only ever carry one
 * arrangement of the family, and this class hides half its keys in each mode.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('SpringBoneSimulator3D', property);
  expect(validator, `no validator registered for SpringBoneSimulator3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Every key SpringBoneSimulator3D registers of its own. `settings/*` is the
 * PLAIN wildcard: the family nests (`end_bone/direction`, `joints/<j>/radius`)
 * and its own dispatcher reads that depth.
 */
const KEYS: string[] = ['external_force', 'mutable_bone_axes', 'setting_count', 'settings/*'];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * What Godot 4.6.3 writes for a two-mode SpringBoneSimulator3D, verbatim.
 *
 * Shared mode (`individual_config = false`) first: the shared block is live, the
 * joint list collapses to the `bone`/`bone_name` pair that
 * `_validate_dynamic_prop`'s `usage ^= PROPERTY_USAGE_STORAGE` hands storage
 * back to, and `joint_count` loses it. Individual mode second: the shared block
 * disappears, `joint_count` and the six per-joint tunables appear.
 */
const RESOLVABLE_KEYS: [string, string][] = [
  // Measured: shared mode.
  ['external_force', 'Vector3(0, 0, 0.1)'],
  ['mutable_bone_axes', 'false'],
  ['setting_count', '1'],
  ['settings/0/root_bone_name', '"Bone0"'],
  ['settings/0/root_bone', '0'],
  ['settings/0/end_bone_name', '"Bone3"'],
  ['settings/0/end_bone', '3'],
  ['settings/0/extend_end_bone', 'true'],
  ['settings/0/end_bone/direction', '6'],
  ['settings/0/end_bone/length', '0.05'],
  ['settings/0/center_from', '2'],
  ['settings/0/center_bone_name', '"Bone0"'],
  ['settings/0/center_bone', '0'],
  ['settings/0/individual_config', 'false'],
  ['settings/0/rotation_axis', '3'],
  ['settings/0/radius/value', '0.02'],
  ['settings/0/radius/damping_curve', 'null'],
  ['settings/0/stiffness/value', '1.0'],
  ['settings/0/stiffness/damping_curve', 'null'],
  ['settings/0/drag/value', '0.4'],
  ['settings/0/drag/damping_curve', 'null'],
  ['settings/0/gravity/value', '0.0'],
  ['settings/0/gravity/damping_curve', 'null'],
  ['settings/0/gravity/direction', 'Vector3(0, -1, 0)'],
  ['settings/0/joints/0/bone_name', '"Bone0"'],
  ['settings/0/joints/0/bone', '0'],
  ['settings/0/joints/3/bone_name', '"Bone3"'],
  ['settings/0/joints/3/bone', '3'],
  ['settings/0/enable_all_child_collisions', 'false'],
  ['settings/0/collision_count', '1'],
  ['settings/0/collisions/0', 'NodePath("Sphere")'],
  // Measured: individual mode, the same node re-saved.
  ['settings/0/joint_count', '4'],
  ['settings/0/joints/0/rotation_axis', '3'],
  ['settings/0/joints/1/rotation_axis', '4'],
  ['settings/0/joints/1/rotation_axis_vector', 'Vector3(1, 0, 0)'],
  ['settings/0/joints/0/radius', '0.1'],
  ['settings/0/joints/0/stiffness', '1.0'],
  ['settings/0/joints/0/drag', '0.0'],
  ['settings/0/joints/0/gravity', '0.0'],
  ['settings/0/joints/0/gravity_direction', 'Vector3(0, -1, 0)'],
  // Constructed, all four of them: each is hidden in whichever state the rows
  // above put this setting into, so no single save can contain them beside the
  // rest. The exclusion pair is only serialised while
  // enable_all_child_collisions is TRUE and it is false above (:330, :333);
  // center_node only while center_from is Node and it is Bone above (:367-369);
  // the shared rotation_axis_vector only while rotation_axis is Custom and it
  // is All above (:385-387). Each takes the shape its measured twin does.
  ['settings/0/exclude_collision_count', '1'],
  ['settings/0/exclude_collisions/0', 'NodePath("Sphere")'],
  ['settings/0/center_node', 'NodePath("..")'],
  ['settings/0/rotation_axis_vector', 'Vector3(1, 0, 0)'],
];

describe('SpringBoneSimulator3D strict validators', () => {
  it('registers exactly what SpringBoneSimulator3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('SpringBoneSimulator3D').sort()).toEqual([...KEYS].sort());
  });

  it('inherits influence from SkeletonModifier3D without re-declaring it', () => {
    // The base-walk, not a copy: `influence` and `active` belong to
    // SkeletonModifier3D and a shadow here would duplicate the rule.
    expect(validatorRegistry.getOwnKeys('SpringBoneSimulator3D')).not.toContain('influence');
    expect(check('influence', '0.5')).toBeNull();
    expect(check('influence', '2')?.severity).toBe('warning');
    expect(check('active', 'true')).toBeNull();
  });

  it('accepts every value its own fixture carries', () => {
    expectFixtureClean('unit-spring-bone-simulator-3d.tscn');
  });

  it.each(RESOLVABLE_KEYS)('resolves and accepts %s = %s', (key, value) => {
    // Resolution AND acceptance in one: a key that reached no validator would
    // fail the first expectation, and one that reached the unknown-leaf branch
    // the second.
    expect(validatorRegistry.findValidator('SpringBoneSimulator3D', key)).not.toBeNull();
    expect(check(key, value)).toBeNull();
  });

  it('rejects a malformed value on every property it validates', () => {
    const accepted = validatorRegistry
      .getOwnKeys('SpringBoneSimulator3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('external_force', () => {
    it('accepts any Vector3, since the hint opens both ends', () => {
      // spring_bone_simulator_3d.cpp:1336, "-99999,99999,or_greater,or_less,…":
      // `or_greater` opens the max end and `or_less` the min end, so a value far
      // outside the printed extents is not even a warning.
      expect(check('external_force', 'Vector3(0, -1e9, 0)')).toBeNull();
      expect(check('external_force', 'Vector3(99999.5, 0, -99999.5)')).toBeNull();
      // set_external_force (:1212) has no is_finite guard either, and Godot's
      // writer spells a non-finite component, so this is a value it round-trips.
      expect(check('external_force', 'Vector3(inf, 0, nan)')).toBeNull();
    });

    it('rejects a non-Vector3', () => {
      expect(check('external_force', 'Vector2(1, 2)')?.severity).toBe('error');
    });
  });

  describe('setting_count', () => {
    it('accepts zero and a positive count', () => {
      expect(check('setting_count', '0')).toBeNull();
      expect(check('setting_count', '4')).toBeNull();
    });

    it('errors below zero, where ERR_FAIL_COND refuses the write', () => {
      // spring_bone_simulator_3d.cpp:841.
      expect(check('setting_count', '-1')?.severity).toBe('error');
    });

    it('warns that a fractional count is truncated', () => {
      expect(check('setting_count', '1.5')?.severity).toBe('warning');
    });
  });

  describe('the settings/<i>/ index', () => {
    it('errors on a negative index, which _set refuses outright', () => {
      const error = check('settings/-1/root_bone_name', '"Head"');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('spring_bone_simulator_3d.cpp:44');
    });

    it('leaves a non-numeric index alone, because to_int resolves it', () => {
      // `_set` reads the index with a bare `to_int()` (:42) and `_to_int` skips
      // non-digits, so `settings/first/root_bone` lands on setting 0.
      expect(check('settings/first/root_bone_name', '"Head"')).toBeNull();
      expect(check('settings/x/joints/0/radius', '0.5')).toBeNull();
    });

    it('carries the negative-index error into the nested sub-arrays too', () => {
      expect(check('settings/-2/joints/0/radius', '0.5')?.severity).toBe('error');
      expect(check('settings/-2/collisions/0', 'NodePath("A")')?.severity).toBe('error');
    });

    it('rejects a nested index to_int resolves as negative, however it is spelled', () => {
      // The nested shapes are parsed here rather than by the shared dispatcher.
      // `_to_int` flips the sign on a `-` seen while the total is still 0
      // (ustring.cpp:2291-2292), so :42 reads `a-1` as -1 and :44 refuses it.
      expect(check('settings/a-1/joints/0/radius', '0.5')?.code).toBe('INVALID_SETTING_INDEX');
      expect(check('settings/a-1/collisions/0', 'NodePath("A")')?.code).toBe(
        'INVALID_SETTING_INDEX'
      );
      // Both `-` flip, because a `0` digit leaves the total at 0, so this one
      // is setting 1 and the write lands.
      expect(check('settings/-0-1/joints/0/radius', '0.5')).toBeNull();
    });

    it('rejects an unrecognised top-level leaf, since no subclass extends this family', () => {
      const error = check('settings/0/not_a_leaf', '1');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_SPRING_BONE_SETTING_KEY');
    });

    it('rejects an unrecognised joints/<j>/ leaf against the joints branch', () => {
      const error = check('settings/0/joints/0/not_a_leaf', '1');
      expect(error?.code).toBe('INVALID_SPRING_BONE_JOINT_KEY');
      expect(error?.message).toContain('spring_bone_simulator_3d.cpp:138-139');
    });

    it('ignores whatever follows the joints dispatch segment', () => {
      // `prop = path.get_slicec('/', 4)` (:123) takes ONE segment, so a tail
      // below it never reaches the comparison and `set_joint_radius` runs.
      expect(check('settings/0/joints/0/radius/extra', '0.5')).toBeNull();
      expect(check('settings/0/joints/0/rotation_axis/x/y', '3')).toBeNull();
      // The joint index stays a whole segment under either shape: `to_int`
      // resolves `x` to joint 0 and the write lands there (:122).
      expect(check('settings/0/joints/x/radius/extra', '0.5')).toBeNull();
      // The segment itself still decides, and its value is still checked.
      expect(check('settings/0/joints/0/not_a_leaf/extra', '1')?.code).toBe(
        'INVALID_SPRING_BONE_JOINT_KEY'
      );
      expect(check('settings/0/joints/0/radius/extra', '-1')?.severity).toBe('warning');
    });
  });

  describe('the bone-index leaves', () => {
    it('accepts -1, the unset sentinel the setter itself writes', () => {
      for (const leaf of ['root_bone', 'end_bone', 'center_bone']) {
        expect(check(`settings/0/${leaf}`, '-1')).toBeNull();
      }
    });

    it('errors below -1, where the setter rewrites the value', () => {
      // spring_bone_simulator_3d.cpp:460-462 / :497-499 / :625-627.
      for (const leaf of ['root_bone', 'end_bone', 'center_bone']) {
        expect(check(`settings/0/${leaf}`, '-2')?.severity).toBe('error');
      }
    });

    it('warns that a fractional bone index is truncated', () => {
      expect(check('settings/0/root_bone', '0.5')?.severity).toBe('warning');
    });
  });

  describe('the hinted ranges', () => {
    it('warns below zero on end_bone/length, whose setter assigns straight through', () => {
      // "0,1,0.001,or_greater,suffix:m" (:299): a hint, not a guard.
      expect(check('settings/0/end_bone/length', '-0.1')?.severity).toBe('warning');
      expect(check('settings/0/end_bone/length', '5')).toBeNull();
    });

    it('warns below zero on the shared radius, stiffness and drag', () => {
      expect(check('settings/0/radius/value', '-1')?.severity).toBe('warning');
      expect(check('settings/0/stiffness/value', '-1')?.severity).toBe('warning');
      expect(check('settings/0/drag/value', '-1')?.severity).toBe('warning');
    });

    it('warns below zero on the per-joint radius, stiffness and drag', () => {
      expect(check('settings/0/joints/2/radius', '-1')?.severity).toBe('warning');
      expect(check('settings/0/joints/2/stiffness', '-1')?.severity).toBe('warning');
      expect(check('settings/0/joints/2/drag', '-1')?.severity).toBe('warning');
    });

    it('leaves the open ceilings alone', () => {
      // `or_greater` on every one of them (:307, :309, :311, :323, :324, :325).
      expect(check('settings/0/stiffness/value', '400')).toBeNull();
      expect(check('settings/0/joints/2/radius', '99')).toBeNull();
    });

    it('bounds gravity at neither end, since its hint opens both', () => {
      // "0,1,0.01,or_greater,or_less,suffix:m/s" (:313, :326).
      expect(check('settings/0/gravity/value', '-9.8')).toBeNull();
      expect(check('settings/0/joints/0/gravity', '-9.8')).toBeNull();
    });

    it('accepts inf and nan, which no setter here guards against', () => {
      expect(check('settings/0/end_bone/length', 'inf')).toBeNull();
      expect(check('settings/0/joints/0/stiffness', 'nan')).toBeNull();
    });
  });

  describe('the enums', () => {
    it('warns outside the BoneDirection hint on end_bone/direction', () => {
      expect(check('settings/0/end_bone/direction', '6')).toBeNull();
      expect(check('settings/0/end_bone/direction', '7')?.severity).toBe('warning');
    });

    it('warns outside the CenterFrom hint on center_from', () => {
      expect(check('settings/0/center_from', '2')).toBeNull();
      expect(check('settings/0/center_from', '3')?.severity).toBe('warning');
    });

    it('warns outside the RotationAxis hint at both levels', () => {
      expect(check('settings/0/rotation_axis', '4')).toBeNull();
      expect(check('settings/0/rotation_axis', '5')?.severity).toBe('warning');
      expect(check('settings/0/joints/1/rotation_axis', '5')?.severity).toBe('warning');
    });
  });

  describe('the damping curves', () => {
    it('accepts the bare null Godot writes for an unset Curve', () => {
      for (const family of ['radius', 'stiffness', 'drag', 'gravity']) {
        expect(check(`settings/0/${family}/damping_curve`, 'null')).toBeNull();
        expect(check(`settings/0/${family}/damping_curve`, 'SubResource("Curve_1")')).toBeNull();
      }
    });

    it('rejects anything that is neither', () => {
      expect(check('settings/0/radius/damping_curve', '0.5')?.severity).toBe('error');
    });
  });

  describe('the gravity directions', () => {
    it('errors on the zero vector, which ERR_FAIL_COND refuses', () => {
      // spring_bone_simulator_3d.cpp:780 and :985.
      expect(check('settings/0/gravity/direction', 'Vector3(0, 0, 0)')?.severity).toBe('error');
      expect(check('settings/0/joints/0/gravity_direction', 'Vector3(0, 0, 0)')?.severity).toBe(
        'error'
      );
    });

    it('errors just inside CMP_EPSILON, because the guard is is_zero_approx', () => {
      // Vector3::is_zero_approx compares each component against 0.00001
      // (vector3.cpp:149-151, math_funcs.h:554), so a hair off zero is still zero.
      expect(check('settings/0/gravity/direction', 'Vector3(0.000001, 0, 0)')?.severity).toBe(
        'error'
      );
      expect(check('settings/0/gravity/direction', 'Vector3(0.0001, 0, 0)')).toBeNull();
    });

    it('accepts a non-finite component, which is_zero_approx does not call zero', () => {
      // `abs(inf) < CMP_EPSILON` and `abs(nan) < CMP_EPSILON` are both false, so
      // Godot's guard passes the vector; the linter's component grammar spells
      // all four non-finite literals, so it reaches this bound to say so.
      expect(check('settings/0/gravity/direction', 'Vector3(0, inf_neg, 0)')).toBeNull();
      expect(check('settings/0/gravity/direction', 'Vector3(nan, nan, nan)')).toBeNull();
      expect(check('settings/0/joints/0/gravity_direction', 'Vector3(inf, 0, 0)')).toBeNull();
    });

    it('rejects a non-Vector3', () => {
      expect(check('settings/0/gravity/direction', '"down"')?.severity).toBe('error');
    });
  });

  describe('the joint list Godot derives', () => {
    it('accepts joints/<j>/bone and bone_name, which the engine writes itself', () => {
      // Declared without STORAGE (:319-320) and given it back by the XOR at
      // :382 whenever individual_config is false, so a scene Godot saved in the
      // default mode carries them. `_set` drops the write and _update_joints
      // re-derives the identical values, so there is nothing to report.
      expect(check('settings/0/joints/0/bone', '3')).toBeNull();
      expect(check('settings/0/joints/0/bone_name', '"Bone3"')).toBeNull();
    });

    it('still checks their format', () => {
      expect(check('settings/0/joints/0/bone', '1.5')?.severity).toBe('warning');
      expect(check('settings/0/joints/0/bone_name', 'Bone3')?.severity).toBe('error');
    });
  });

  describe('the collision lists', () => {
    it('accepts a NodePath in either list', () => {
      expect(check('settings/0/collisions/0', 'NodePath("Sphere")')).toBeNull();
      expect(check('settings/0/exclude_collisions/2', 'NodePath("")')).toBeNull();
    });

    // variant.cpp:746-749 lists STRING (not STRING_NAME) as a strict source for NODE_PATH.
    it('rejects a non-NodePath', () => {
      expect(check('settings/0/collisions/0', '"Sphere"')).toBeNull();
      expect(check('settings/0/collisions/0', '&"Sphere"')?.severity).toBe('error');
    });

    it('ignores whatever follows a collision index', () => {
      // Both branches read the index and nothing below it (:143-145, :148-150),
      // then hand the value straight to the setter.
      expect(check('settings/0/collisions/0/extra', 'NodePath("Sphere")')).toBeNull();
      expect(check('settings/0/exclude_collisions/0/extra', 'NodePath("Sphere")')).toBeNull();
      // The value is judged as on the bare key: STRING converts strictly to
      // NODE_PATH (variant.cpp:746-749), STRING_NAME does not.
      expect(check('settings/0/collisions/0/extra', '"Sphere"')).toBeNull();
      expect(check('settings/0/collisions/0/extra', '&"Sphere"')?.severity).toBe('error');
    });

    it('claims no floor on either count, since neither setter guards one', () => {
      // set_collision_count (:1179) and set_exclude_collision_count (:1123) hand
      // the value straight to LocalVector::resize, unlike setting_count (:841)
      // and joint_count (:1054), which both open with ERR_FAIL_COND(p_count < 0).
      expect(check('settings/0/collision_count', '-1')).toBeNull();
      expect(check('settings/0/exclude_collision_count', '-1')).toBeNull();
      expect(check('settings/0/joint_count', '-1')?.severity).toBe('error');
    });
  });
});
