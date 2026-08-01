/**
 * SoftBody3D strict validators: format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * One case per property (happy, malformed, and any bound), quoting the
 * governing Godot source line beside every numeric bound. Assertions check
 * `error?.code`, not message text: the message form can't tell a malformed
 * value apart from an out-of-range one, so a lost bound would still pass.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { MAX_LAYER_BITMASK } from '../../../../linter/validators/index';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('SoftBody3D', property);
  expect(validator, `no validator registered for SoftBody3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('SoftBody3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('SoftBody3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('SoftBody3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('collision_layer', () => {
    it('accepts a value in range', () => {
      expect(check('collision_layer', '1')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('collision_layer', 'abc')?.code).toBe('INVALID_COLLISION_LAYER_FORMAT');
    });

    it('accepts the full 32-bit mask (soft_body_3d.cpp:381, PROPERTY_HINT_LAYERS_3D_PHYSICS)', () => {
      expect(check('collision_layer', String(MAX_LAYER_BITMASK))).toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('collision_layer', '-1')?.code).toBe('INVALID_COLLISION_LAYER_VALUE');
    });
  });

  describe('collision_mask', () => {
    it('accepts a value in range', () => {
      expect(check('collision_mask', '1')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('collision_mask', 'abc')?.code).toBe('INVALID_COLLISION_MASK_FORMAT');
    });

    it('accepts the full 32-bit mask (soft_body_3d.cpp:382, PROPERTY_HINT_LAYERS_3D_PHYSICS)', () => {
      expect(check('collision_mask', String(MAX_LAYER_BITMASK))).toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('collision_mask', '-1')?.code).toBe('INVALID_COLLISION_MASK_VALUE');
    });
  });

  describe('damping_coefficient', () => {
    it('accepts a value in range', () => {
      expect(check('damping_coefficient', '0.05')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('damping_coefficient', 'abc')?.code).toBe('INVALID_DAMPING_COEFFICIENT_FORMAT');
    });

    it('rejects a negative value (soft_body_3d.cpp:390, or_greater keeps 0 the only enforced bound)', () => {
      expect(check('damping_coefficient', '-0.1')?.code).toBe('INVALID_DAMPING_COEFFICIENT_VALUE');
    });

    it('accepts a value far beyond the editor slider extent (or_greater)', () => {
      expect(check('damping_coefficient', '50')).toBeNull();
    });
  });

  describe('disable_mode', () => {
    it('accepts REMOVE (0)', () => {
      expect(check('disable_mode', '0')).toBeNull();
    });

    it('accepts KEEP_ACTIVE (1)', () => {
      expect(check('disable_mode', '1')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('disable_mode', 'abc')?.code).toBe('INVALID_DISABLE_MODE_FORMAT');
    });

    it('rejects a value outside SoftBody3D.DisableMode (soft_body_3d.cpp:397-398, only 2 constants)', () => {
      expect(check('disable_mode', '2')?.code).toBe('INVALID_DISABLE_MODE_VALUE');
    });
  });

  describe('drag_coefficient', () => {
    it('accepts a value in range', () => {
      expect(check('drag_coefficient', '0.5')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('drag_coefficient', 'abc')?.code).toBe('INVALID_DRAG_COEFFICIENT_FORMAT');
    });

    it('accepts the upper bound 1 (soft_body_3d.cpp:391, hard bound, no or_greater)', () => {
      expect(check('drag_coefficient', '1')).toBeNull();
    });

    it('rejects a value above 1', () => {
      expect(check('drag_coefficient', '1.1')?.code).toBe('INVALID_DRAG_COEFFICIENT_VALUE');
    });
  });

  describe('linear_stiffness', () => {
    it('accepts a value in range', () => {
      expect(check('linear_stiffness', '0.5')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('linear_stiffness', 'abc')?.code).toBe('INVALID_LINEAR_STIFFNESS_FORMAT');
    });

    it('accepts the upper bound 1 (soft_body_3d.cpp:387, hard bound, no or_greater)', () => {
      expect(check('linear_stiffness', '1')).toBeNull();
    });

    it('rejects a value above 1', () => {
      expect(check('linear_stiffness', '1.1')?.code).toBe('INVALID_LINEAR_STIFFNESS_VALUE');
    });
  });

  describe('parent_collision_ignore', () => {
    it('accepts a NodePath', () => {
      expect(check('parent_collision_ignore', 'NodePath("../StaticBody3D")')).toBeNull();
    });

    it('accepts the default empty NodePath', () => {
      expect(check('parent_collision_ignore', 'NodePath("")')).toBeNull();
    });

    it('rejects a value that is not a NodePath literal', () => {
      expect(check('parent_collision_ignore', '../StaticBody3D')?.code).toBe(
        'INVALID_PARENT_COLLISION_IGNORE_PATH'
      );
    });
  });

  describe('pressure_coefficient', () => {
    it('accepts a value (soft_body_3d.cpp:389, no PROPERTY_HINT_RANGE at all)', () => {
      expect(check('pressure_coefficient', '2.5')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('pressure_coefficient', 'abc')?.code).toBe('INVALID_PRESSURE_COEFFICIENT_FORMAT');
    });

    it('accepts a negative value, since no bound is hinted', () => {
      expect(check('pressure_coefficient', '-5')).toBeNull();
    });
  });

  describe('ray_pickable', () => {
    it('accepts true', () => {
      expect(check('ray_pickable', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('ray_pickable', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('ray_pickable', 'not-a-bool')?.code).toBe('INVALID_RAY_PICKABLE_FORMAT');
    });
  });

  describe('shrinking_factor', () => {
    it('accepts a value in the editor slider extent', () => {
      expect(check('shrinking_factor', '0.1')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('shrinking_factor', 'abc')?.code).toBe('INVALID_SHRINKING_FACTOR_FORMAT');
    });

    it('accepts a value beyond both slider extents (soft_body_3d.cpp:388, or_less AND or_greater both present)', () => {
      expect(check('shrinking_factor', '-5')).toBeNull();
      expect(check('shrinking_factor', '5')).toBeNull();
    });
  });

  describe('simulation_precision', () => {
    it('accepts a value in range', () => {
      expect(check('simulation_precision', '5')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('simulation_precision', 'abc')?.code).toBe('INVALID_SIMULATION_PRECISION_FORMAT');
    });

    it('rejects 0, below the lower bound (soft_body_3d.cpp:385, hard bound "1,100,1")', () => {
      expect(check('simulation_precision', '0')?.code).toBe('INVALID_SIMULATION_PRECISION_VALUE');
    });

    it('rejects a value above 100', () => {
      expect(check('simulation_precision', '101')?.code).toBe('INVALID_SIMULATION_PRECISION_VALUE');
    });
  });

  describe('total_mass', () => {
    it('accepts a value in range', () => {
      expect(check('total_mass', '2.5')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('total_mass', 'abc')?.code).toBe('INVALID_TOTAL_MASS_FORMAT');
    });

    it('rejects a negative value (soft_body_3d.cpp:386, or_greater keeps 0 the only enforced bound)', () => {
      expect(check('total_mass', '-0.1')?.code).toBe('INVALID_TOTAL_MASS_VALUE');
    });

    it('accepts a value far beyond the editor slider extent (or_greater)', () => {
      expect(check('total_mass', '5000')).toBeNull();
    });
  });
});
