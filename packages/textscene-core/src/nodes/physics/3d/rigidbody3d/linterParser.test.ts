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
  const validator = validatorRegistry.declarationFor('RigidBody3D', property);
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

  describe('max_contacts_reported', () => {
    // rigid_body_3d.cpp:524, ERR_FAIL_INDEX_MSG(p_amount,
    // MAX_CONTACTS_REPORTED_3D_MAX): the constant is 4096
    // (physics_server_3d.h:36) and ERR_FAIL_INDEX fails on `>=`, so the setter
    // refuses 4096 and everything above it. Hint :781 is "0,64,1,or_greater".
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
      expect(error?.message).toContain('Godot does not store this value');
      expect(check('max_contacts_reported', '100000')?.severity).toBe('error');
    });

    it('refuses a negative count', () => {
      expect(check('max_contacts_reported', '-5')?.severity).toBe('error');
    });

    it('carries the setter ceiling in the enforced slot, leaving the or_greater end of `bounds` open', () => {
      const validator = validatorRegistry.declarationFor('RigidBody3D', 'max_contacts_reported');
      expect(validator?.bounds).toEqual({ min: 0, enforcedMax: { at: 4096, exclusive: true } });
    });
  });
});
