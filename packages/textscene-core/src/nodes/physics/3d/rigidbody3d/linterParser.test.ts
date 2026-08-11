/**
 * RigidBody3D strict validators: the physics-state quartet
 * (linear_velocity/angular_velocity/constant_force/constant_torque), all
 * Vector3 unlike RigidBody2D's scalar torque and angular velocity. Asserted
 * through validatorRegistry rather than a full scene lint: the unit under
 * test is the validator, not scene parsing.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('RigidBody3D', property);
  expect(validator, `no validator registered for RigidBody3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('RigidBody3D strict validators (physics state)', () => {
  describe('linear_velocity', () => {
    it('accepts a Vector3', () => {
      expect(check('linear_velocity', 'Vector3(0, 0, 0)')).toBeNull();
    });

    it('accepts large and negative components; no bound (rigid_body_3d.cpp:783 is PROPERTY_HINT_NONE; set_linear_velocity :470-473 is a bare assignment)', () => {
      expect(check('linear_velocity', 'Vector3(-5000.5, 100000, 3.2)')).toBeNull();
    });

    it('accepts inf, a literal Godot writes and reloads', () => {
      expect(check('linear_velocity', 'Vector3(inf, -inf, 0)')).toBeNull();
    });

    it('rejects a Vector2, the 2D shape', () => {
      const error = check('linear_velocity', 'Vector2(0, 0)');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('linear_velocity');
    });
  });

  describe('angular_velocity', () => {
    // rigid_body_3d.cpp:787: Variant::VECTOR3. 3D angular velocity is a
    // vector, unlike RigidBody2D's scalar. PROPERTY_HINT_NONE;
    // set_angular_velocity (:479-482) is a bare assignment, so no bound.
    it('accepts a Vector3', () => {
      expect(check('angular_velocity', 'Vector3(1.5, 0, -2.5)')).toBeNull();
    });

    it('accepts nan, a literal Godot writes and reloads', () => {
      expect(check('angular_velocity', 'Vector3(nan, 0, 0)')).toBeNull();
    });

    it('rejects a scalar, the 2D shape', () => {
      expect(check('angular_velocity', '1.5')?.severity).toBe('error');
    });
  });

  describe('constant_force', () => {
    it('accepts a Vector3', () => {
      expect(check('constant_force', 'Vector3(10, -5, 0)')).toBeNull();
    });

    it('rejects a Vector2, the 2D shape', () => {
      expect(check('constant_force', 'Vector2(1, 2)')?.severity).toBe('error');
    });
  });

  describe('constant_torque', () => {
    // rigid_body_3d.cpp:792: Variant::VECTOR3. 3D constant_torque is a
    // vector, unlike RigidBody2D's scalar. set_constant_torque (:584-586)
    // passes straight to the physics server with no guard, so no bound.
    it('accepts a Vector3', () => {
      expect(check('constant_torque', 'Vector3(1, 1, 1)')).toBeNull();
    });

    it('rejects a scalar, the 2D shape', () => {
      expect(check('constant_torque', '3.0')?.severity).toBe('error');
    });
  });
});
