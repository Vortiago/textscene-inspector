/**
 * TubeTrailMesh linter validators. The full barrel, not `./linterValidators`: `flip_faces` is
 * PrimitiveMesh's, and this slice alone does not load the class that declares it.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { runResourcePropertyValidation, subResource } from '../../../linter/testing/testkit.js';
import '../../../linter/index';

runResourcePropertyValidation(
  'TubeTrailMesh',
  [
    {
      prop: 'radius',
      valid: ['0.5', '0.001', '100', '5000'],
      // The hint's floor is 0.001; `set_radius` stores any value but an approximately equal one (primitive_meshes.cpp:2388).
      invalid: [{ value: '0', contains: ['radius'], severity: 'warning' }],
    },
    {
      prop: 'radial_steps',
      valid: ['3', '8', '128'],
      // `set_radial_steps` ERR_FAILs outside 3 to 128 (primitive_meshes.cpp:2402), keeping the old value.
      invalid: [
        { value: '2', contains: ['radial_steps'], severity: 'error' },
        { value: '129', contains: ['radial_steps'], severity: 'error' },
      ],
    },
    {
      prop: 'sections',
      valid: ['2', '5', '128'],
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
      prop: 'section_rings',
      valid: ['1', '3', '128'],
      // The setter takes 1 to 1024 (primitive_meshes.cpp:2437). The slider stops at 128, so 129 to
      // 1024 are legal and past the hint, and 1025 is refused.
      invalid: [
        { value: '129', contains: ['section_rings'], severity: 'warning' },
        { value: '1024', contains: ['section_rings'], severity: 'warning' },
        { value: '0', contains: ['section_rings'], severity: 'error' },
        { value: '1025', contains: ['section_rings'], severity: 'error' },
      ],
    },
    {
      prop: 'cap_top',
      valid: ['true', 'false'],
      invalid: [{ value: 'yes', contains: ['cap_top'], severity: 'error' }],
    },
    {
      prop: 'cap_bottom',
      valid: ['true', 'false'],
      invalid: [{ value: 'yes', contains: ['cap_bottom'], severity: 'error' }],
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

describe('TubeTrailMesh inherited validators', () => {
  it("reaches PrimitiveMesh's flip_faces", () => {
    expect(validatorRegistry.findValidator('TubeTrailMesh', 'flip_faces')).not.toBeNull();
  });
});
