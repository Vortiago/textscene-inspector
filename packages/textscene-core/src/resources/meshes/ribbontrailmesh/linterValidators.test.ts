/**
 * RibbonTrailMesh linter validators. The full barrel, not `./linterValidators`: `flip_faces` is
 * PrimitiveMesh's, and this slice alone does not load the class that declares it.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { runResourcePropertyValidation, subResource } from '../../../linter/testing/testkit.js';
import '../../../linter/index';

runResourcePropertyValidation(
  'RibbonTrailMesh',
  [
    {
      prop: 'shape',
      valid: ['0', '1'],
      invalid: [{ value: 'yes', contains: ['shape'], severity: 'error' }],
    },
    {
      prop: 'size',
      valid: ['1', '0.001', '100', '5000'],
      // The hint's floor is 0.001; `set_size` stores any value (primitive_meshes.cpp:2799).
      invalid: [{ value: '0', contains: ['size'], severity: 'warning' }],
    },
    {
      prop: 'sections',
      valid: ['2', '5', '128'],
      // `set_sections` ERR_FAILs outside 2 to 128 (primitive_meshes.cpp:2814), keeping the old value.
      invalid: [
        { value: '1', contains: ['sections'], severity: 'error' },
        { value: '129', contains: ['sections'], severity: 'error' },
      ],
    },
    {
      prop: 'section_length',
      valid: ['0.2', '0.001', '4096'],
      invalid: [{ value: '-1', contains: ['section_length'], severity: 'warning' }],
    },
    {
      prop: 'section_segments',
      valid: ['1', '3', '128'],
      // The setter takes 1 to 1024 (primitive_meshes.cpp:2837). The slider stops at 128, so 129 to
      // 1024 are legal and past the hint, and 1025 is refused.
      invalid: [
        { value: '129', contains: ['section_segments'], severity: 'warning' },
        { value: '1024', contains: ['section_segments'], severity: 'warning' },
        { value: '0', contains: ['section_segments'], severity: 'error' },
        { value: '1025', contains: ['section_segments'], severity: 'error' },
      ],
    },
    {
      prop: 'curve',
      valid: ['null', 'SubResource("Curve_a")', 'ExtResource("1_curve")'],
      invalid: [{ value: '3', contains: ['curve'], severity: 'error' }],
    },
  ],
  {
    prefix: [
      subResource('Curve', {}, 'Curve_a'),
      '[ext_resource type="Curve" path="res://shrink.tres" id="1_curve"]',
    ],
  }
);

describe('RibbonTrailMesh inherited validators', () => {
  it("reaches PrimitiveMesh's flip_faces", () => {
    expect(validatorRegistry.findValidator('RibbonTrailMesh', 'flip_faces')).not.toBeNull();
  });
});
