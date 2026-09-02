/**
 * The `Material` base validators, asked for through a leaf a scene names.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { runResourcePropertyValidation } from '../../../linter/testing/testkit.js';
import '../../../linter/index';

runResourcePropertyValidation('StandardMaterial3D', [
  {
    prop: 'render_priority',
    valid: ['0', '-128', '127'],
    invalid: [
      // ERR_FAIL_COND at both ends (material.cpp:65-66), so the write never
      // lands and the tier is the error one, not the inspector's warning.
      { value: '128', contains: ['render_priority'], severity: 'error' },
      { value: '-129', contains: ['render_priority'], severity: 'error' },
    ],
  },
  {
    prop: 'next_pass',
    valid: ['SubResource("Mat_2")', 'ExtResource("1_abc")'],
    invalid: [{ value: 'res://other.tres', contains: ['next_pass'], severity: 'error' }],
  },
], {
  // The reference cases name these, so the declared-id pass stays quiet.
  prefix: ['[sub_resource type="Material" id="Mat_2"]', '[ext_resource type="Material" path="res://m.tres" id="1_abc"]'],
});

describe('Material base validators', () => {
  it('reaches every material leaf, not only the one with a slice', () => {
    for (const type of ['StandardMaterial3D', 'ORMMaterial3D', 'ShaderMaterial']) {
      expect(validatorRegistry.findValidator(type, 'render_priority')).not.toBeNull();
    }
  });
});
