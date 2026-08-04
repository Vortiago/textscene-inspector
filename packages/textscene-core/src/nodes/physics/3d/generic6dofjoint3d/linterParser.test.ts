/**
 * Generic6DOFJoint3D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through
 * `Linter` — this node has none: the shared `valid-joint` rule
 * (nodes/physics/joints/shared/linter.ts) already covers node_a/node_b.
 *
 * Bounds are quoted from the governing Godot source line beside every case.
 * Every group is wildcard-dispatched (`<group>_<axis>/*`) onto ONE shared
 * leaf table per group, because Godot's x/y/z `ADD_PROPERTYI` calls carry
 * byte-identical `PropertyInfo` per leaf — so a case exercised on axis `x`
 * proves the bound for `y` and `z` too. Each `describe` below still picks a
 * DIFFERENT axis per group, so the axis-stripping regex itself is exercised
 * against all three letters, not just `x`.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('Generic6DOFJoint3D', property);
  expect(validator, `no validator registered for Generic6DOFJoint3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('Generic6DOFJoint3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('Generic6DOFJoint3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('Generic6DOFJoint3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  // generic_6dof_joint_3d.cpp:54-59 — ADD_GROUP("Linear Limit", "linear_limit_").
  describe('linear_limit_x/* (Linear Limit group)', () => {
    it('accepts a boolean enabled flag', () => {
      expect(check('linear_limit_x/enabled', 'true')).toBeNull();
      expect(check('linear_limit_x/enabled', 'false')).toBeNull();
    });

    it('rejects a non-boolean enabled flag', () => {
      expect(check('linear_limit_x/enabled', 'maybe')?.code).toBe('INVALID_ENABLED_FORMAT');
    });

    it('accepts upper_distance/lower_distance unbounded (PROPERTY_HINT_NONE, no range)', () => {
      expect(check('linear_limit_x/upper_distance', '99999')).toBeNull();
      expect(check('linear_limit_x/lower_distance', '-99999')).toBeNull();
    });

    it('warns past softness/restitution/damping 0.01-16 (set_param_x/y/z index-guards only)', () => {
      expect(check('linear_limit_x/softness', '0.01')).toBeNull();
      expect(check('linear_limit_x/softness', '16')).toBeNull();
      expect(check('linear_limit_x/softness', '16.5')?.code).toBe('INVALID_SOFTNESS_VALUE');
      expect(check('linear_limit_x/softness', '16.5')?.severity).toBe('warning');
      expect(check('linear_limit_x/restitution', '17')?.code).toBe('INVALID_RESTITUTION_VALUE');
      expect(check('linear_limit_x/restitution', '17')?.severity).toBe('warning');
      expect(check('linear_limit_x/damping', '0')?.code).toBe('INVALID_DAMPING_VALUE');
      expect(check('linear_limit_x/damping', '0')?.severity).toBe('warning');
    });
  });

  // generic_6dof_joint_3d.cpp:77-79 — ADD_GROUP("Linear Motor", "linear_motor_"), axis y.
  describe('linear_motor_y/* (Linear Motor group)', () => {
    it('accepts target_velocity/force_limit unbounded (PROPERTY_HINT_NONE, no range)', () => {
      expect(check('linear_motor_y/target_velocity', '-99999')).toBeNull();
      expect(check('linear_motor_y/force_limit', '99999')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('linear_motor_y/target_velocity', 'fast')?.code).toBe(
        'INVALID_TARGET_VELOCITY_FORMAT'
      );
    });
  });

  // generic_6dof_joint_3d.cpp:91-94 — ADD_GROUP("Linear Spring", "linear_spring_"), axis z.
  describe('linear_spring_z/* (Linear Spring group)', () => {
    it('accepts stiffness/damping unbounded (no PropertyInfo hint at all)', () => {
      expect(check('linear_spring_z/stiffness', '99999')).toBeNull();
      expect(check('linear_spring_z/damping', '-99999')).toBeNull();
    });

    it('accepts equilibrium_point unbounded (PROPERTY_HINT_NONE, "suffix:m")', () => {
      expect(check('linear_spring_z/equilibrium_point', '99999')).toBeNull();
    });

    // linear_spring/damping is unbounded, unlike linear_limit/damping's
    // 0.01-16 — the same leaf NAME, a genuinely different bound by GROUP,
    // which is exactly why each group gets its own leaf table rather than
    // one shared by leaf name across the whole node.
    it('accepts a value linear_limit/damping would reject, proving the groups do not share a bound', () => {
      expect(check('linear_spring_z/damping', '0')).toBeNull();
      expect(check('linear_limit_z/damping', '0')?.code).toBe('INVALID_DAMPING_VALUE');
    });
  });

  // generic_6dof_joint_3d.cpp:108-115 — ADD_GROUP("Angular Limit", "angular_limit_").
  describe('angular_limit_x/* (Angular Limit group)', () => {
    it('bounds upper_angle/lower_angle to ±π radians (±180° hint, radian-converted)', () => {
      expect(check('angular_limit_x/upper_angle', '0.5')).toBeNull();
      expect(check('angular_limit_x/upper_angle', Math.PI.toFixed(6))).toBeNull();
      expect(check('angular_limit_x/lower_angle', (-Math.PI).toFixed(6))).toBeNull();
    });

    // Proves the radian conversion: 4.0 radians is well past ±π yet nowhere
    // near the ±180 a naive reader of the hint's raw degree numbers would
    // expect as the literal bound.
    it('warns past ±π radians (the ±180° hint converted) rather than erroring', () => {
      const upper = check('angular_limit_x/upper_angle', '4.0');
      const lower = check('angular_limit_x/lower_angle', '-4.0');
      expect(upper?.code).toBe('INVALID_UPPER_ANGLE_VALUE');
      expect(upper?.severity).toBe('warning');
      expect(lower?.code).toBe('INVALID_LOWER_ANGLE_VALUE');
      expect(lower?.severity).toBe('warning');
    });

    it('warns past softness/restitution/damping 0.01-16 (set_param_x/y/z index-guards only)', () => {
      expect(check('angular_limit_x/softness', '0.01')).toBeNull();
      const restitution = check('angular_limit_x/restitution', '17');
      expect(restitution?.code).toBe('INVALID_RESTITUTION_VALUE');
      expect(restitution?.severity).toBe('warning');
      expect(check('angular_limit_x/damping', '16')).toBeNull();
    });

    it('accepts force_limit/erp unbounded', () => {
      expect(check('angular_limit_x/force_limit', '99999')).toBeNull();
      expect(check('angular_limit_x/erp', '-99999')).toBeNull();
    });
  });

  // generic_6dof_joint_3d.cpp:137-139 — ADD_GROUP("Angular Motor", "angular_motor_"), axis y.
  describe('angular_motor_y/* (Angular Motor group)', () => {
    // target_velocity carries a "radians_as_degrees" DISPLAY hint but rides on
    // PROPERTY_HINT_NONE, not PROPERTY_HINT_RANGE — there is no range to
    // convert, so it stays a plain unbounded float rather than v.radians.
    it('accepts target_velocity unbounded despite the radians_as_degrees display hint', () => {
      expect(check('angular_motor_y/target_velocity', '99999')).toBeNull();
      expect(check('angular_motor_y/target_velocity', '-99999')).toBeNull();
    });

    it('accepts force_limit unbounded', () => {
      expect(check('angular_motor_y/force_limit', '99999')).toBeNull();
    });
  });

  // generic_6dof_joint_3d.cpp:151-164 — ADD_GROUP("Angular Spring", "angular_spring_"), axis z.
  describe('angular_spring_z/* (Angular Spring group)', () => {
    it('accepts stiffness/damping unbounded (no PropertyInfo hint at all)', () => {
      expect(check('angular_spring_z/stiffness', '99999')).toBeNull();
      expect(check('angular_spring_z/damping', '-99999')).toBeNull();
    });

    it('warns past ±π radians (±180° hint, radian-converted) rather than erroring', () => {
      expect(check('angular_spring_z/equilibrium_point', '0.3')).toBeNull();
      const error = check('angular_spring_z/equilibrium_point', '4.0');
      expect(error?.code).toBe('INVALID_EQUILIBRIUM_POINT_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  describe('unknown leaf', () => {
    it('rejects a key whose leaf name no ADD_PROPERTYI call registers, per group', () => {
      expect(check('linear_limit_x/not_a_real_leaf', '1')?.code).toBe('INVALID_LINEAR_LIMIT_KEY');
      expect(check('angular_spring_y/not_a_real_leaf', '1')?.code).toBe('INVALID_ANGULAR_SPRING_KEY');
    });
  });
});
