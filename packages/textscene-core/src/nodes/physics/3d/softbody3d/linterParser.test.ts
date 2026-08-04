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
      expect(check('collision_layer', '4294967295')).toBeNull();
    });

    it('warns on a negative value rather than erroring', () => {
      // soft_body_3d.cpp:381 hints PROPERTY_HINT_LAYERS_3D_PHYSICS, a
      // 32-checkbox widget that cannot express -1, so the width is a UI bound.
      // The setter is a bare assignment, so the engine itself accepts it.
      expect(check('collision_layer', '-1')?.severity).toBe('warning');
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
      expect(check('collision_mask', '4294967295')).toBeNull();
    });

    it('warns on a negative value rather than erroring', () => {
      // soft_body_3d.cpp:382 hints PROPERTY_HINT_LAYERS_3D_PHYSICS, a
      // 32-checkbox widget that cannot express -1, so the width is a UI bound.
      // The setter is a bare assignment, so the engine itself accepts it.
      expect(check('collision_mask', '-1')?.severity).toBe('warning');
    });
  });

  describe('damping_coefficient', () => {
    it('accepts a value in range', () => {
      expect(check('damping_coefficient', '0.05')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('damping_coefficient', 'abc')?.code).toBe('INVALID_DAMPING_COEFFICIENT_FORMAT');
    });

    it('warns on a negative value rather than erroring (set_damping_coefficient has no guard)', () => {
      const error = check('damping_coefficient', '-0.1');
      expect(error?.code).toBe('INVALID_DAMPING_COEFFICIENT_VALUE');
      expect(error?.severity).toBe('warning');
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

    it('warns on a value outside SoftBody3D.DisableMode rather than erroring (bare assignment)', () => {
      const error = check('disable_mode', '2');
      expect(error?.code).toBe('INVALID_DISABLE_MODE_VALUE');
      expect(error?.severity).toBe('warning');
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

    it('warns above 1 rather than erroring (set_drag_coefficient has no guard)', () => {
      const error = check('drag_coefficient', '1.1');
      expect(error?.code).toBe('INVALID_DRAG_COEFFICIENT_VALUE');
      expect(error?.severity).toBe('warning');
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

    it('warns above 1 rather than erroring (set_linear_stiffness has no guard)', () => {
      const error = check('linear_stiffness', '1.1');
      expect(error?.code).toBe('INVALID_LINEAR_STIFFNESS_VALUE');
      expect(error?.severity).toBe('warning');
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

    it('warns on 0, below the lower bound, rather than erroring (set_simulation_precision has no guard)', () => {
      const error = check('simulation_precision', '0');
      expect(error?.code).toBe('INVALID_SIMULATION_PRECISION_VALUE');
      expect(error?.severity).toBe('warning');
    });

    it('warns above 100 rather than erroring', () => {
      const error = check('simulation_precision', '101');
      expect(error?.code).toBe('INVALID_SIMULATION_PRECISION_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  describe('total_mass', () => {
    it('accepts a value in range', () => {
      expect(check('total_mass', '2.5')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('total_mass', 'abc')?.code).toBe('INVALID_TOTAL_MASS_FORMAT');
    });

    it('warns on a negative value rather than erroring (set_total_mass has no guard)', () => {
      const error = check('total_mass', '-0.1');
      expect(error?.code).toBe('INVALID_TOTAL_MASS_VALUE');
      expect(error?.severity).toBe('warning');
    });

    it('accepts a value far beyond the editor slider extent (or_greater)', () => {
      expect(check('total_mass', '5000')).toBeNull();
    });
  });
});
