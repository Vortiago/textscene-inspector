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
});
