/**
 * VehicleWheel3D strict validators, asserted through `validatorRegistry` so a
 * failure points at the validator, not at scene parsing. Assertions check
 * `error?.code`, not the message: the message cannot tell a malformed value from
 * an out-of-range one, so a lost bound would still pass.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('VehicleWheel3D', property);
  expect(validator, `no validator registered for VehicleWheel3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('VehicleWheel3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('VehicleWheel3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose validates no format. The
    // per-property cases follow.
    const accepted = validatorRegistry
      .getOwnKeys('VehicleWheel3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  // vehicle_body_3d.cpp ADD_PROPERTY: PROPERTY_HINT_RANGE
  // "-1024,1024,0.01,or_less,or_greater,...". or_less and or_greater make both
  // bounds soft editor extents. The setter assigns the value unchecked, so any
  // finite float is valid.
  describe('engine_force', () => {
    it('accepts a value inside the documented slider range', () => {
      expect(check('engine_force', '25.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('engine_force', 'not-a-number');
      expect(error?.code).toBe('INVALID_ENGINE_FORCE_FORMAT');
    });

    it('accepts a value beyond the soft slider extents (or_less/or_greater)', () => {
      expect(check('engine_force', '2048.0')).toBeNull();
      expect(check('engine_force', '-2048.0')).toBeNull();
    });
  });

  // vehicle_body_3d.cpp ADD_PROPERTY: PROPERTY_HINT_RANGE
  // "-128,128,0.01,or_less,or_greater,...". Same soft-range shape as engine_force.
  describe('brake', () => {
    it('accepts a value inside the documented slider range', () => {
      expect(check('brake', '12.5')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('brake', 'not-a-number');
      expect(error?.code).toBe('INVALID_BRAKE_FORMAT');
    });

    it('accepts a value beyond the soft slider extents (or_less/or_greater)', () => {
      expect(check('brake', '256.0')).toBeNull();
    });
  });

  // vehicle_body_3d.cpp ADD_PROPERTY: PROPERTY_HINT_RANGE
  // "-180,180,0.01,radians_as_degrees", with no or_less or or_greater. The hint's
  // degrees describe the slider. A .tscn stores radians
  // (doc/classes/VehicleWheel3D.xml), so the bound is ±π.
  describe('steering', () => {
    it('accepts a value inside ±π radians', () => {
      expect(check('steering', '0.3927')).toBeNull();
    });

    it('accepts the exact ±π bound', () => {
      expect(check('steering', Math.PI.toFixed(6))).toBeNull();
      expect(check('steering', (-Math.PI).toFixed(6))).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('steering', 'not-a-number');
      expect(error?.code).toBe('INVALID_STEERING_FORMAT');
    });

    it('warns past ±π radians (the ±180 degree bound converted) rather than erroring', () => {
      const error = check('steering', '4.0');
      expect(error?.code).toBe('INVALID_STEERING_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // vehicle_body_3d.cpp ADD_PROPERTY(PropertyInfo(Variant::BOOL, "use_as_traction"), ...): no hint, plain bool.
  describe('use_as_traction', () => {
    it('accepts true', () => {
      expect(check('use_as_traction', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('use_as_traction', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('use_as_traction', '1');
      expect(error?.code).toBe('INVALID_USE_AS_TRACTION_FORMAT');
    });
  });

  // vehicle_body_3d.cpp ADD_PROPERTY(PropertyInfo(Variant::BOOL, "use_as_steering"), ...): no hint, plain bool.
  describe('use_as_steering', () => {
    it('accepts true', () => {
      expect(check('use_as_steering', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('use_as_steering', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('use_as_steering', '0');
      expect(error?.code).toBe('INVALID_USE_AS_STEERING_FORMAT');
    });
  });

  // vehicle_body_3d.cpp ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "wheel_roll_influence"), ...):
  // no PROPERTY_HINT_RANGE, so any finite float is valid.
  describe('wheel_roll_influence', () => {
    it('accepts a documented example value', () => {
      expect(check('wheel_roll_influence', '0.1')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('wheel_roll_influence', 'not-a-number');
      expect(error?.code).toBe('INVALID_WHEEL_ROLL_INFLUENCE_FORMAT');
    });

    it('accepts a value outside 0-1, since Godot enforces no range here', () => {
      expect(check('wheel_roll_influence', '5.0')).toBeNull();
    });
  });

  // vehicle_body_3d.cpp ADD_PROPERTY(..., "wheel_radius", PROPERTY_HINT_NONE, "suffix:m"): no range, plain float.
  describe('wheel_radius', () => {
    it('accepts a documented example value', () => {
      expect(check('wheel_radius', '0.5')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('wheel_radius', 'not-a-number');
      expect(error?.code).toBe('INVALID_WHEEL_RADIUS_FORMAT');
    });

    it('accepts a large value, since PROPERTY_HINT_NONE carries no bound', () => {
      expect(check('wheel_radius', '100.0')).toBeNull();
    });
  });

  // vehicle_body_3d.cpp ADD_PROPERTY(..., "wheel_rest_length", PROPERTY_HINT_NONE, "suffix:m"): no range, plain float.
  describe('wheel_rest_length', () => {
    it('accepts a documented example value', () => {
      expect(check('wheel_rest_length', '0.15')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('wheel_rest_length', 'not-a-number');
      expect(error?.code).toBe('INVALID_WHEEL_REST_LENGTH_FORMAT');
    });

    it('accepts a large value, since PROPERTY_HINT_NONE carries no bound', () => {
      expect(check('wheel_rest_length', '10.0')).toBeNull();
    });
  });

  // vehicle_body_3d.cpp ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "wheel_friction_slip"), ...): no hint, plain float.
  describe('wheel_friction_slip', () => {
    it('accepts a documented example value', () => {
      expect(check('wheel_friction_slip', '10.5')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('wheel_friction_slip', 'not-a-number');
      expect(error?.code).toBe('INVALID_WHEEL_FRICTION_SLIP_FORMAT');
    });

    it('accepts a value beyond 1.0, since Godot enforces no range here', () => {
      expect(check('wheel_friction_slip', '50.0')).toBeNull();
    });
  });

  // vehicle_body_3d.cpp ADD_PROPERTY(..., "suspension_travel", PROPERTY_HINT_NONE, "suffix:m"): no range, plain float.
  describe('suspension_travel', () => {
    it('accepts a documented example value', () => {
      expect(check('suspension_travel', '0.2')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('suspension_travel', 'not-a-number');
      expect(error?.code).toBe('INVALID_SUSPENSION_TRAVEL_FORMAT');
    });

    it('accepts a large value, since PROPERTY_HINT_NONE carries no bound', () => {
      expect(check('suspension_travel', '5.0')).toBeNull();
    });
  });

  // vehicle_body_3d.cpp ADD_PROPERTY(..., "suspension_stiffness", PROPERTY_HINT_NONE, "suffix:N/mm"): no range, plain float.
  describe('suspension_stiffness', () => {
    it('accepts a documented example value', () => {
      expect(check('suspension_stiffness', '5.88')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('suspension_stiffness', 'not-a-number');
      expect(error?.code).toBe('INVALID_SUSPENSION_STIFFNESS_FORMAT');
    });

    it('accepts a value well above the "Formula 1" ~200 example, since Godot enforces no range', () => {
      expect(check('suspension_stiffness', '500.0')).toBeNull();
    });
  });

  // vehicle_body_3d.cpp ADD_PROPERTY(..., "suspension_max_force", PROPERTY_HINT_NONE, "suffix:..."): no range, plain float.
  describe('suspension_max_force', () => {
    it('accepts a documented example value', () => {
      expect(check('suspension_max_force', '6000.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('suspension_max_force', 'not-a-number');
      expect(error?.code).toBe('INVALID_SUSPENSION_MAX_FORCE_FORMAT');
    });

    it('accepts a very large value, since PROPERTY_HINT_NONE carries no bound', () => {
      expect(check('suspension_max_force', '100000.0')).toBeNull();
    });
  });

  // vehicle_body_3d.cpp ADD_PROPERTY(..., "damping_compression", PROPERTY_HINT_NONE, "suffix:N⋅s/mm"): no range, plain float.
  describe('damping_compression', () => {
    it('accepts a documented example value', () => {
      expect(check('damping_compression', '0.83')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('damping_compression', 'not-a-number');
      expect(error?.code).toBe('INVALID_DAMPING_COMPRESSION_FORMAT');
    });

    it('accepts a value above 1.0, since the doc says "may be more" and Godot enforces no range', () => {
      expect(check('damping_compression', '2.5')).toBeNull();
    });
  });

  // vehicle_body_3d.cpp ADD_PROPERTY(..., "damping_relaxation", PROPERTY_HINT_NONE, "suffix:N⋅s/mm"): no range, plain float.
  describe('damping_relaxation', () => {
    it('accepts a documented example value', () => {
      expect(check('damping_relaxation', '0.88')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('damping_relaxation', 'not-a-number');
      expect(error?.code).toBe('INVALID_DAMPING_RELAXATION_FORMAT');
    });

    it('accepts a value above 1.0, since the doc says "may be more" and Godot enforces no range', () => {
      expect(check('damping_relaxation', '2.5')).toBeNull();
    });
  });
});
