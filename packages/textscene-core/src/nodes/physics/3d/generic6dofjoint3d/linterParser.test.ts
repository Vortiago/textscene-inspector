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

    // Both ends closed, one step (0.01) outside each.
    it.each(['softness', 'restitution', 'damping'])(
      'accepts %s at both endpoints and warns one step past either (0.01-16, hinted)',
      (leaf) => {
        expect(check(`linear_limit_x/${leaf}`, '0.01')).toBeNull();
        expect(check(`linear_limit_x/${leaf}`, '16')).toBeNull();
        const code = `INVALID_${leaf.toUpperCase()}_VALUE`;
        for (const outside of ['0', '16.01']) {
          const error = check(`linear_limit_x/${leaf}`, outside);
          expect(error?.code, outside).toBe(code);
          expect(error?.severity, outside).toBe('warning');
        }
      }
    );
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

    it.each(['softness', 'damping'])(
      'accepts %s at both endpoints and warns one step past either (0.01-16, hinted)',
      (leaf) => {
        expect(check(`angular_limit_x/${leaf}`, '0.01')).toBeNull();
        expect(check(`angular_limit_x/${leaf}`, '16')).toBeNull();
        const code = `INVALID_${leaf.toUpperCase()}_VALUE`;
        for (const outside of ['0', '16.01']) {
          const error = check(`angular_limit_x/${leaf}`, outside);
          expect(error?.code, outside).toBe(code);
          expect(error?.severity, outside).toBe('warning');
        }
      }
    );

    it('warns on an angular restitution of 0, below the hint Godot declares', () => {
      // Godot's constructor writes 0 on every axis (:330, :360, :390), under its
      // own hint floor of 0.01 (:112). The contradiction is the engine's: the
      // hint is what it DECLARES, `set_param_*` guards only the param index, and
      // 0 really is outside the range the inspector offers. A default is also
      // omitted when serialised, so this fires only on an explicit 0.
      for (const axis of ['x', 'y', 'z']) {
        expect(check(`angular_limit_${axis}/restitution`, '0')?.severity, axis).toBe('warning');
      }
      expect(check('angular_limit_x/restitution', '0.01')).toBeNull();
      expect(check('angular_limit_x/restitution', '16')).toBeNull();
      expect(check('angular_limit_x/restitution', '16.01')?.code).toBe('INVALID_RESTITUTION_VALUE');
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

  describe('dispatcher-level classification (boundGrounding.test.ts sweep)', () => {
    // The sweep inspects the function registered under the wildcard key
    // itself, not the per-leaf validators it forwards to, so each of the 6
    // shared dispatchers needs its own formatOnly/grounding tag even though
    // every leaf above is already individually grounded.
    function dispatcher(key: string) {
      const validator = validatorRegistry.findValidator('Generic6DOFJoint3D', key);
      expect(validator, `no validator registered for Generic6DOFJoint3D.${key}`).not.toBeNull();
      return validator!;
    }

    it('tags groups with a real hinted bound as bounded + grounded, on every axis', () => {
      // Pinned to the exact governing line per group (not a shape-only regex):
      // softness (linear_limit), upper_angle (angular_limit) and
      // equilibrium_point (angular_spring) are each the FIRST hinted bound in
      // that group's leaf table above.
      const expectedCite: Record<string, string> = {
        linear_limit: 'generic_6dof_joint_3d.cpp:57',
        angular_limit: 'generic_6dof_joint_3d.cpp:109',
        angular_spring: 'generic_6dof_joint_3d.cpp:154',
      };
      for (const group of Object.keys(expectedCite)) {
        for (const axis of ['x', 'y', 'z']) {
          const validator = dispatcher(`${group}_${axis}/*`);
          expect(validator.grounding, `${group}_${axis}/*`).toBeDefined();
          expect(validator.grounding, `${group}_${axis}/*`).toEqual({
            kind: 'hinted',
            cite: expectedCite[group],
          });
        }
      }
    });

    it('tags groups with no bound anywhere as format-only, on every axis', () => {
      for (const group of ['linear_motor', 'linear_spring', 'angular_motor']) {
        for (const axis of ['x', 'y', 'z']) {
          const validator = dispatcher(`${group}_${axis}/*`);
          expect(validator.formatOnly, `${group}_${axis}/*`).toBe(true);
          expect(validator.grounding, `${group}_${axis}/*`).toBeUndefined();
        }
      }
    });

    it('shares one dispatcher instance across all three axes per group', () => {
      // Confirms tagging one instance covers all 18 registrations, not just 6.
      expect(dispatcher('linear_limit_x/*')).toBe(dispatcher('linear_limit_y/*'));
      expect(dispatcher('linear_limit_y/*')).toBe(dispatcher('linear_limit_z/*'));
    });
  });

  // A sweep that reads `bounds`/`tiers` off `findValidator` gets the dispatcher,
  // which carries neither, so every bound in this slice read as UNIMPLEMENTED
  // while being fully coded. Each bounded leaf is therefore also registered
  // under its exact key, where the wildcard cannot hide it. Without these cases
  // the exact registrations can be deleted with every other test still green.
  describe('bounded leaves are readable off the registry, not only behind the wildcard', () => {
    const AXES = ['x', 'y', 'z'];
    const BOTH_ENDS = { min: 0.01, max: 16 };

    function reported(key: string) {
      const validator = validatorRegistry.findValidator('Generic6DOFJoint3D', key);
      expect(validator, `no validator registered for Generic6DOFJoint3D.${key}`).not.toBeNull();
      return validator!;
    }

    it.each([
      ['linear_limit', 'softness'],
      ['linear_limit', 'restitution'],
      ['linear_limit', 'damping'],
      ['angular_limit', 'softness'],
      ['angular_limit', 'damping'],
    ])('reports %s_*/%s as 0.01-16, both ends warning', (group, leaf) => {
      for (const axis of AXES) {
        const validator = reported(`${group}_${axis}/${leaf}`);
        expect(validator.bounds, `${group}_${axis}/${leaf}`).toEqual(BOTH_ENDS);
        expect(validator.tiers, `${group}_${axis}/${leaf}`).toEqual({
          min: 'warning',
          max: 'warning',
        });
      }
    });

    it('reports angular restitution with both ends, as its linear twin does', () => {
      for (const axis of AXES) {
        const validator = reported(`angular_limit_${axis}/restitution`);
        expect(validator.bounds, axis).toEqual({ min: 0.01, max: 16 });
        expect(validator.tiers, axis).toEqual({ min: 'warning', max: 'warning' });
      }
    });

    it('leaves an unbounded leaf to the wildcard rather than claiming a bound for it', () => {
      // The dispatcher must stay bound-free: `enabled` and `upper_distance` sit
      // in the same group with no hint at all, so a bound tagged on the group
      // would misdescribe them.
      expect(validatorRegistry.getOwnKeys('Generic6DOFJoint3D')).not.toContain(
        'linear_limit_x/upper_distance'
      );
      expect(reported('linear_limit_x/upper_distance').bounds).toBeUndefined();
      expect(reported('linear_limit_x/*').bounds).toBeUndefined();
    });

    it('returns the same verdict through the exact key as through the wildcard', () => {
      // The exact registration is a reporting change, not a behavioural one: the
      // dispatcher forwards the FULL key to this same leaf function.
      const leaf = reported('linear_limit_x/softness');
      const viaWildcard = reported('linear_limit_x/*');
      for (const value of ['0', '0.01', '8', '16', '16.01', 'fast']) {
        expect(leaf('linear_limit_x/softness', value, 1), value).toEqual(
          viaWildcard('linear_limit_x/softness', value, 1)
        );
      }
    });
  });
});
