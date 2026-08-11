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

  describe('can_sleep, sleeping, custom_integrator', () => {
    it.each(['can_sleep', 'sleeping', 'custom_integrator'])('accepts true/false for %s', (property) => {
      expect(check(property, 'true')).toBeNull();
      expect(check(property, 'false')).toBeNull();
    });

    it.each(['can_sleep', 'sleeping', 'custom_integrator'])('rejects a numeric stand-in for %s', (property) => {
      expect(check(property, '1')?.severity).toBe('error');
    });
  });
});
