/**
 * SoftBody3D strict validators, asserted through `validatorRegistry` so a failure
 * points at the validator, not at scene parsing. Each bound quotes its Godot line.
 * Assertions check `error?.code`, not the message: the message cannot tell a
 * malformed value from an out-of-range one, so a lost bound would still pass.
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
    // A validator that accepts arbitrary prose validates no format. The
    // per-property cases follow.
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

    it('accepts a negative value: -1 IS the all-layers mask', () => {
      // soft_body_3d.cpp:381 hints PROPERTY_HINT_LAYERS_3D_PHYSICS, and its
      // 32 checkboxes express every 32-bit pattern including this one.
      expect(check('collision_layer', '-1')).toBeNull();
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

    it('accepts a negative value: -1 IS the all-layers mask', () => {
      // soft_body_3d.cpp:382 hints PROPERTY_HINT_LAYERS_3D_PHYSICS, and its
      // 32 checkboxes express every 32-bit pattern including this one.
      expect(check('collision_mask', '-1')).toBeNull();
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

    it('errors on a negative value: the guard is in the physics SERVER, not the node', () => {
      // The node setter forwards without checking, so reading it alone reads as
      // unguarded. `GodotSoftBody3D::set_total_mass` opens with
      // `ERR_FAIL_COND(p_val < 0.0)` and the default server is that one.
      const error = check('total_mass', '-0.1');
      expect(error?.code).toBe('INVALID_TOTAL_MASS_VALUE');
      expect(error?.severity).toBe('error');
    });

    it('accepts a value far beyond the editor slider extent (or_greater)', () => {
      expect(check('total_mass', '5000')).toBeNull();
    });
  });

  describe('pinned_points', () => {
    it('accepts an empty bare array', () => {
      expect(check('pinned_points', '[]')).toBeNull();
    });

    it('accepts a bare int array (the actual serialised form: the GETTER returns an untyped Array)', () => {
      expect(check('pinned_points', '[0, 3, 7]')).toBeNull();
    });

    it('accepts the declared PackedInt32Array spelling too (Variant::operator Array() converts it)', () => {
      expect(check('pinned_points', 'PackedInt32Array(0, 3, 7)')).toBeNull();
    });

    // variant_parser.cpp:1428-1430 narrows toward zero; Godot loads point 1.
    it('warns that a float element is truncated rather than refusing it', () => {
      expect(check('pinned_points', '[0, 1.5]')?.severity).toBe('warning');
    });

    it('still rejects an element Godot cannot tokenise at all', () => {
      expect(check('pinned_points', '[0, 1abc]')?.code).toBe('INVALID_PINNED_POINTS_FORMAT');
    });

    it('rejects a value that is neither array spelling', () => {
      expect(check('pinned_points', '5')?.code).toBe('INVALID_PINNED_POINTS_FORMAT');
    });
  });

  describe('attachments/<i>/*', () => {
    function checkAttachment(key: string, value: string) {
      const validator = validatorRegistry.findValidator('SoftBody3D', key);
      expect(validator, `no validator resolved for SoftBody3D.${key}`).not.toBeNull();
      return validator!(key, value, 1);
    }

    it('accepts point_index: Godot writes the key itself, even though the setter drops it', () => {
      // `_set_property_pinned_points_attachment` drops the write
      // (soft_body_3d.cpp:238-239), but the PropertyInfo at :180 has no usage
      // argument, so it defaults to STORAGE and Godot's own exporter emits it.
      // Rejecting it rejects the engine's own output.
      expect(checkAttachment('attachments/0/point_index', '3')).toBeNull();
    });

    it('still rejects a non-integer point_index', () => {
      expect(checkAttachment('attachments/0/point_index', 'not-an-int')).not.toBeNull();
    });

    it('accepts a NodePath for spatial_attachment_path', () => {
      expect(checkAttachment('attachments/0/spatial_attachment_path', 'NodePath("../Anchor")')).toBeNull();
    });

    it('accepts the default empty NodePath for spatial_attachment_path', () => {
      expect(checkAttachment('attachments/0/spatial_attachment_path', 'NodePath("")')).toBeNull();
    });

    it('accepts a Vector3 offset', () => {
      expect(checkAttachment('attachments/0/offset', 'Vector3(0, 0, 0)')).toBeNull();
    });

    it('resolves a non-numeric index (bare to_int, no is_valid_int gate) rather than treating it as unknown', () => {
      // soft_body_3d.cpp:137: `to_int()` skips non-digits rather than
      // refusing them, so the index resolves to some attachment and the leaf
      // lookup is the only thing left to reject.
      expect(checkAttachment('attachments/x/offset', 'Vector3(0, 0, 0)')).toBeNull();
    });

    it('rejects an unrecognised leaf name', () => {
      const error = checkAttachment('attachments/0/not_a_real_leaf', '1');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_ATTACHMENT_KEY');
    });
  });
});
