/**
 * VehicleBody3D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * Grow this into one case per property — happy, malformed, and any bound — and
 * quote the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('VehicleBody3D', property);
  expect(validator, `no validator registered for VehicleBody3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('VehicleBody3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('VehicleBody3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('VehicleBody3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  // scene/3d/physics/vehicle_body_3d.cpp ADD_PROPERTY: PROPERTY_HINT_RANGE
  // "-1024,1024,0.01,or_less,or_greater,...". or_less/or_greater make both
  // bounds soft editor extents, not an enforced range: the setter assigns the
  // value straight through, so any finite float is valid.
  describe('engine_force', () => {
    it('accepts a value inside the documented slider range', () => {
      expect(check('engine_force', '40.0')).toBeNull();
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

  // scene/3d/physics/vehicle_body_3d.cpp ADD_PROPERTY: PROPERTY_HINT_RANGE
  // "-128,128,0.01,or_less,or_greater,...". Same soft-range shape as engine_force.
  describe('brake', () => {
    it('accepts a value inside the documented slider range', () => {
      expect(check('brake', '25.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('brake', 'not-a-number');
      expect(error?.code).toBe('INVALID_BRAKE_FORMAT');
    });

    it('accepts a value beyond the soft slider extents (or_less/or_greater)', () => {
      expect(check('brake', '256.0')).toBeNull();
    });
  });

  // scene/3d/physics/vehicle_body_3d.cpp ADD_PROPERTY: PROPERTY_HINT_RANGE
  // "-180,180,0.01,radians_as_degrees" — no or_less/or_greater, a hard bound.
  // The hint's degrees describe the inspector slider; the value serialised
  // into a .tscn is radians (doc/classes/VehicleBody3D.xml), so the bound is
  // ±π radians, not ±180.
  describe('steering', () => {
    it('accepts a value inside ±π radians', () => {
      expect(check('steering', '0.5')).toBeNull();
    });

    it('accepts the exact ±π bound', () => {
      expect(check('steering', Math.PI.toFixed(6))).toBeNull();
      expect(check('steering', (-Math.PI).toFixed(6))).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('steering', 'not-a-number');
      expect(error?.code).toBe('INVALID_STEERING_FORMAT');
    });

    it('rejects a value past ±π radians (the ±180 degree bound converted to radians)', () => {
      const error = check('steering', '4.0');
      expect(error?.code).toBe('INVALID_STEERING_VALUE');
    });
  });
});
