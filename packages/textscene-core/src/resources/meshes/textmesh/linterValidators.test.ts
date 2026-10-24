/**
 * TextMesh linter validators. The full barrel, not `./linterValidators`: `flip_faces` is
 * PrimitiveMesh's, and this slice alone does not load the class that declares it.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { runResourcePropertyValidation } from '../../../linter/testing/testkit.js';
import '../../../linter/index';

runResourcePropertyValidation('TextMesh', [
  {
    prop: 'font_size',
    valid: ['1', '16', '127'],
    // `set_font_size` clamps to 1 to 127 (primitive_meshes.cpp:3813), so 0 and 128 are altered.
    invalid: [
      { value: '0', contains: ['font_size'], severity: 'error' },
      { value: '128', contains: ['font_size'], severity: 'error' },
    ],
  },
  {
    prop: 'horizontal_alignment',
    valid: ['0', '1', '2', '3'],
    invalid: [{ value: '4', contains: ['horizontal_alignment'], severity: 'error' }],
  },
  {
    prop: 'vertical_alignment',
    valid: ['0', '1', '2'],
    // The hint offers three labels while the setter takes four (:3728), so FILL warns and 4 errors.
    invalid: [
      { value: '3', contains: ['vertical_alignment'], severity: 'warning' },
      { value: '4', contains: ['vertical_alignment'], severity: 'error' },
    ],
  },
  {
    prop: 'pixel_size',
    valid: ['0.01', '0.0001', '128'],
    invalid: [
      { value: '0', contains: ['pixel_size'], severity: 'error' },
      { value: '129', contains: ['pixel_size'], severity: 'error' },
    ],
  },
  {
    prop: 'curve_step',
    valid: ['0.5', '0.1', '10'],
    invalid: [
      { value: '0.05', contains: ['curve_step'], severity: 'error' },
      { value: '11', contains: ['curve_step'], severity: 'error' },
    ],
  },
  {
    prop: 'depth',
    valid: ['0', '0.05', '500'],
    // `set_depth` raises a negative value to 0 (:3861) and the hint's top is open.
    invalid: [{ value: '-1', contains: ['depth'], severity: 'error' }],
  },
  {
    prop: 'text_direction',
    valid: ['0', '1', '2'],
    // The hint offers three labels while the setter takes -1 to 3 (:3918), so -1 and 3 warn.
    invalid: [
      { value: '-1', contains: ['text_direction'], severity: 'warning' },
      { value: '3', contains: ['text_direction'], severity: 'warning' },
      { value: '-2', contains: ['text_direction'], severity: 'error' },
      { value: '4', contains: ['text_direction'], severity: 'error' },
    ],
  },
  {
    prop: 'width',
    valid: ['500', '0', '-1'],
    invalid: [{ value: 'wide', contains: ['width'], severity: 'error' }],
  },
  {
    prop: 'uppercase',
    valid: ['true', 'false'],
    invalid: [{ value: 'maybe', contains: ['uppercase'], severity: 'error' }],
  },
]);

describe('TextMesh validators', () => {
  it('own the text properties, and inherit the PrimitiveMesh ones', () => {
    expect(validatorRegistry.getOwnKeys('TextMesh')).toContain('font_size');
    expect(validatorRegistry.findValidator('TextMesh', 'flip_faces')).not.toBeNull();
  });
});
