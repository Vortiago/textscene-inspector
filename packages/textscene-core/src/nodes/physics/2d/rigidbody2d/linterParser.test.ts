/**
 * RigidBody2D strict validators: the physics-state quartet plus
 * continuous_cd and the sleep/integrator switches. Asserted through
 * validatorRegistry rather than a full scene lint: the unit under test is
 * the validator, not scene parsing.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('RigidBody2D', property);
  expect(validator, `no validator registered for RigidBody2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('RigidBody2D strict validators (physics state)', () => {
  describe('linear_velocity', () => {
    it('accepts a Vector2', () => {
      expect(check('linear_velocity', 'Vector2(0, 0)')).toBeNull();
    });

    it('accepts large and negative components; no bound (rigid_body_2d.cpp:761 is PROPERTY_HINT_NONE; set_linear_velocity :451-454 is a bare assignment)', () => {
      expect(check('linear_velocity', 'Vector2(-5000.5, 100000)')).toBeNull();
    });

    it('accepts inf, a literal Godot writes and reloads', () => {
      expect(check('linear_velocity', 'Vector2(inf, -inf)')).toBeNull();
    });

    it('rejects a Vector3', () => {
      const error = check('linear_velocity', 'Vector3(0, 0, 0)');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('linear_velocity');
    });
  });

  describe('angular_velocity', () => {
    it('accepts a float', () => {
      expect(check('angular_velocity', '1.5')).toBeNull();
    });

    it('accepts a large negative value; no bound', () => {
      expect(check('angular_velocity', '-999.9')).toBeNull();
    });

    it('accepts nan, a literal Godot writes and reloads', () => {
      expect(check('angular_velocity', 'nan')).toBeNull();
    });

    it('rejects text that is not a float at all', () => {
      expect(check('angular_velocity', 'fast')?.severity).toBe('error');
    });
  });

  describe('constant_force', () => {
    it('accepts a Vector2', () => {
      expect(check('constant_force', 'Vector2(10, -5)')).toBeNull();
    });

    it('rejects a Vector3, the 3D shape', () => {
      expect(check('constant_force', 'Vector3(1, 2, 3)')?.severity).toBe('error');
    });
  });

  describe('constant_torque', () => {
    it('accepts a float', () => {
      expect(check('constant_torque', '3.0')).toBeNull();
    });

    it('rejects a Vector3, the 3D shape', () => {
      expect(check('constant_torque', 'Vector3(1, 1, 1)')?.severity).toBe('error');
    });
  });

  describe('continuous_cd', () => {
    it.each(['0', '1', '2'])('accepts the enum value %s', (value) => {
      expect(check('continuous_cd', value)).toBeNull();
    });

    it('warns rather than errors outside the enum range', () => {
      // rigid_body_2d.cpp:757 hints PROPERTY_HINT_ENUM "Disabled,Cast
      // Ray,Cast Shape"; set_continuous_collision_detection_mode (:566-569)
      // assigns straight through, so out-of-range is the widget's complaint.
      const error = check('continuous_cd', '5');
      expect(error?.severity).toBe('warning');
      expect(error?.message).toContain('0-2');
    });

    it('rejects a non-numeric value', () => {
      expect(check('continuous_cd', '"ray"')?.severity).toBe('error');
    });
  });

  describe('max_contacts_reported', () => {
    // rigid_body_2d.cpp:501, ERR_FAIL_INDEX_MSG(p_amount,
    // MAX_CONTACTS_REPORTED_2D_MAX): the constant is 4096
    // (physics_server_2d.h:37) and ERR_FAIL_INDEX fails on `>=`, so the setter
    // refuses 4096 and everything above it. Hint :759 is "0,64,1,or_greater".
    it('accepts the largest count the setter takes', () => {
      expect(check('max_contacts_reported', '4095')).toBeNull();
    });

    it('accepts a count far past the hint slider extent of 64', () => {
      expect(check('max_contacts_reported', '2000')).toBeNull();
    });

    it('refuses the constant itself and above — ERR_FAIL_INDEX fails at >= 4096', () => {
      const error = check('max_contacts_reported', '4096');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('less than 4096');
      expect(error?.message).toContain("Godot's setter refuses the write");
      expect(check('max_contacts_reported', '100000')?.severity).toBe('error');
    });

    it('refuses a negative count', () => {
      expect(check('max_contacts_reported', '-5')?.severity).toBe('error');
    });

    it('carries the setter ceiling in the enforced slot, leaving the or_greater end of `bounds` open', () => {
      const validator = validatorRegistry.findValidator('RigidBody2D', 'max_contacts_reported');
      expect(validator?.bounds).toEqual({ min: 0, enforcedMax: { at: 4096, exclusive: true } });
    });
  });

  describe('can_sleep, sleeping, custom_integrator', () => {
    it.each(['can_sleep', 'sleeping', 'custom_integrator'])('accepts true/false for %s', (property) => {
      expect(check(property, 'true')).toBeNull();
      expect(check(property, 'false')).toBeNull();
    });

    it.each(['can_sleep', 'sleeping', 'custom_integrator'])('converts a numeric stand-in for %s', (property) => {
      expect(check(property, '1')?.severity).toBe('warning');
    });
  });
});
