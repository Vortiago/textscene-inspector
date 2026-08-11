/**
 * GridMap strict validators: format and bound checks.
 *
 * `data` and `baked_meshes` are the hand-rolled `_set`/`_get` route
 * propertyListRouteCoverage.test.ts tracks — see linterParser.ts's header.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('GridMap', property);
  expect(validator, `no validator registered for GridMap.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('GridMap strict validators', () => {
  describe('data', () => {
    it('accepts the empty Dictionary', () => {
      expect(check('data', '{}')).toBeNull();
    });

    it('accepts a Dictionary with no "cells" key (grid_map.cpp:67 skips it entirely)', () => {
      expect(check('data', '{\n"unrelated": 1\n}')).toBeNull();
    });

    it('accepts a cells count that is a multiple of 3', () => {
      expect(
        check('data', '{\n"cells": PackedInt32Array(0, 0, 0, 1, 0, 0)\n}')
      ).toBeNull();
    });

    it('accepts an empty cells array', () => {
      expect(check('data', '{\n"cells": PackedInt32Array()\n}')).toBeNull();
    });

    it('rejects a cells count that is not a multiple of 3 (grid_map.cpp:71, ERR_FAIL_COND_V)', () => {
      const error = check('data', '{\n"cells": PackedInt32Array(0, 0)\n}');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_DATA_CELLS_COUNT');
    });

    it('rejects a value that is not a Dictionary literal at all', () => {
      expect(check('data', 'PackedInt32Array(0, 0, 0)')?.code).toBe('INVALID_DATA_FORMAT');
    });
  });

  describe('baked_meshes', () => {
    it('accepts an empty Array', () => {
      expect(check('baked_meshes', '[]')).toBeNull();
    });

    it('accepts an Array of resource references', () => {
      expect(
        check('baked_meshes', '[SubResource("ArrayMesh_1"), SubResource("ArrayMesh_2")]')
      ).toBeNull();
    });

    it('rejects a null entry (grid_map.cpp:97, ERR_CONTINUE silently drops it and shifts every later index)', () => {
      const error = check('baked_meshes', '[SubResource("ArrayMesh_1"), null]');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_BAKED_MESHES_ENTRY');
    });

    it('rejects a value that is not an Array literal at all', () => {
      expect(check('baked_meshes', 'SubResource("ArrayMesh_1")')?.code).toBe(
        'INVALID_BAKED_MESHES_FORMAT'
      );
    });
  });

  describe('bake_navigation', () => {
    // grid_map.cpp:1265 — plain BOOL, no hint.
    it('accepts "true" and "false"', () => {
      expect(check('bake_navigation', 'true')).toBeNull();
      expect(check('bake_navigation', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('bake_navigation', 'yes');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_BAKE_NAVIGATION_FORMAT');
    });
  });

  describe('cell_octant_size', () => {
    // grid_map.cpp:1253 — PROPERTY_HINT_RANGE "1,1024,1". set_octant_size
    // (:313-317) opens with ERR_FAIL_COND(p_size == 0): an ENFORCED refusal of
    // exactly zero. Nothing else is clamped, so a value outside [1,1024] that
    // is not 0 (e.g. a negative octant size) only warns, per the hint.
    it('accepts the minimum bound', () => {
      expect(check('cell_octant_size', '1')).toBeNull();
    });

    it('accepts the maximum bound', () => {
      expect(check('cell_octant_size', '1024')).toBeNull();
    });

    it('accepts the documented default of 8', () => {
      expect(check('cell_octant_size', '8')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('cell_octant_size', 'big');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_CELL_OCTANT_SIZE_FORMAT');
    });

    it('errors on exactly 0 (grid_map.cpp:313, ERR_FAIL_COND refuses the write)', () => {
      const error = check('cell_octant_size', '0');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_CELL_OCTANT_SIZE_VALUE');
      expect(error!.severity).toBe('error');
    });

    it('warns on a negative value (the setter only refuses exactly 0, not negatives)', () => {
      const error = check('cell_octant_size', '-5');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_CELL_OCTANT_SIZE_VALUE');
      expect(error!.severity).toBe('warning');
    });

    it('warns beyond the 1024 hint ceiling rather than erroring', () => {
      const error = check('cell_octant_size', '2000');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_CELL_OCTANT_SIZE_VALUE');
      expect(error!.severity).toBe('warning');
    });
  });

  describe('cell_scale', () => {
    // grid_map.cpp:1257 — plain FLOAT, no hint. set_cell_scale (:1273-1276) is
    // a bare assignment: nothing to bound, so every finite value, plus every
    // non-finite spelling Godot's own writer produces, is accepted.
    it('accepts a positive value', () => {
      expect(check('cell_scale', '1')).toBeNull();
    });

    it('accepts zero', () => {
      expect(check('cell_scale', '0')).toBeNull();
    });

    it('accepts a negative value (no floor)', () => {
      expect(check('cell_scale', '-2')).toBeNull();
    });

    it('accepts inf, inf_neg, and nan: unbounded, so no comparison can trip', () => {
      expect(check('cell_scale', 'inf')).toBeNull();
      expect(check('cell_scale', 'inf_neg')).toBeNull();
      expect(check('cell_scale', 'nan')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('cell_scale', 'big');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_CELL_SCALE_FORMAT');
    });
  });

  describe('collision_layer', () => {
    // grid_map.cpp:1260 — PROPERTY_HINT_LAYERS_3D_PHYSICS. set_collision_layer
    // (:162-165) is a bare assignment, so out-of-range warns.
    it('accepts a single-layer mask', () => {
      expect(check('collision_layer', '1')).toBeNull();
    });

    it('accepts zero (no layers)', () => {
      expect(check('collision_layer', '0')).toBeNull();
    });

    it('accepts the full 32-bit mask', () => {
      expect(check('collision_layer', '4294967295')).toBeNull();
    });

    it('rejects a non-numeric mask', () => {
      const error = check('collision_layer', 'not-a-number');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_COLLISION_LAYER_FORMAT');
    });

    it('warns on a negative mask rather than erroring', () => {
      const error = check('collision_layer', '-1');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_COLLISION_LAYER_VALUE');
      expect(error!.severity).toBe('warning');
    });

    it('warns on a mask beyond the 32-bit range rather than erroring', () => {
      const error = check('collision_layer', '4294967296');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_COLLISION_LAYER_VALUE');
      expect(error!.severity).toBe('warning');
    });
  });

  describe('collision_mask', () => {
    // grid_map.cpp:1261 — PROPERTY_HINT_LAYERS_3D_PHYSICS. set_collision_mask
    // (:171-174) is a bare assignment, so out-of-range warns.
    it('accepts a single-layer mask', () => {
      expect(check('collision_mask', '1')).toBeNull();
    });

    it('accepts zero (no layers)', () => {
      expect(check('collision_mask', '0')).toBeNull();
    });

    it('accepts the full 32-bit mask', () => {
      expect(check('collision_mask', '4294967295')).toBeNull();
    });

    it('rejects a non-numeric mask', () => {
      const error = check('collision_mask', 'not-a-number');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_COLLISION_MASK_FORMAT');
    });

    it('warns on a negative mask rather than erroring', () => {
      const error = check('collision_mask', '-1');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_COLLISION_MASK_VALUE');
      expect(error!.severity).toBe('warning');
    });

    it('warns on a mask beyond the 32-bit range rather than erroring', () => {
      const error = check('collision_mask', '4294967296');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_COLLISION_MASK_VALUE');
      expect(error!.severity).toBe('warning');
    });
  });

  describe('collision_priority', () => {
    // grid_map.cpp:1262 — plain FLOAT, no hint. set_collision_priority
    // (:210-213) is a bare assignment: nothing to bound, so every finite
    // value, plus every non-finite spelling Godot's own writer produces, is
    // accepted.
    it('accepts a positive value', () => {
      expect(check('collision_priority', '1')).toBeNull();
    });

    it('accepts zero', () => {
      expect(check('collision_priority', '0')).toBeNull();
    });

    it('accepts a negative value (no floor)', () => {
      expect(check('collision_priority', '-1')).toBeNull();
    });

    it('accepts inf, inf_neg, and nan: unbounded, so no comparison can trip', () => {
      expect(check('collision_priority', 'inf')).toBeNull();
      expect(check('collision_priority', 'inf_neg')).toBeNull();
      expect(check('collision_priority', 'nan')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('collision_priority', 'high');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_COLLISION_PRIORITY_FORMAT');
    });
  });

  describe('physics_material', () => {
    // grid_map.cpp:1249 — PROPERTY_HINT_RESOURCE_TYPE "PhysicsMaterial". Godot
    // omits the key entirely when cleared, so this validator is never asked to
    // accept an absence — only a present reference's format.
    it('accepts a SubResource reference', () => {
      expect(check('physics_material', 'SubResource("PhysicsMaterial_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('physics_material', 'ExtResource("1")')).toBeNull();
    });

    it('rejects a value that is not a resource reference', () => {
      const error = check('physics_material', 'PhysicsMaterial_1');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_PHYSICS_MATERIAL_REFERENCE');
    });
  });
});
