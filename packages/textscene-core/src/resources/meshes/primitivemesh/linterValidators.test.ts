/**
 * The `PrimitiveMesh` and `Mesh` base validators, asked for through PlaneMesh —
 * the leaf a scene names, one and two hops below the classes that declare them.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { runResourcePropertyValidation } from '../../../linter/testing/testkit.js';
import '../../../linter/index';

runResourcePropertyValidation('PlaneMesh', [
  {
    prop: 'uv2_padding',
    valid: ['0', '2.0', '48'],
    // `or_greater` opens the ceiling, so only the floor bounds it, and
    // `set_uv2_padding` bare-assigns: outside the hint is a warning.
    invalid: [{ value: '-1', contains: ['uv2_padding'], severity: 'warning' }],
  },
  {
    prop: 'flip_faces',
    valid: ['true', 'false'],
    invalid: [{ value: 'yes', contains: ['flip_faces'], severity: 'error' }],
  },
  {
    prop: 'add_uv2',
    valid: ['true'],
    invalid: [{ value: '1', contains: ['add_uv2'], severity: 'error' }],
  },
  {
    prop: 'custom_aabb',
    valid: ['AABB(0, 0, 0, 1, 1, 1)'],
    invalid: [{ value: 'AABB(0, 0, 0)', contains: ['custom_aabb'], severity: 'error' }],
  },
  {
    prop: 'material',
    valid: ['SubResource("Mat_1")', 'ExtResource("1_abc")'],
    invalid: [{ value: 'res://mat.tres', contains: ['material'], severity: 'error' }],
  },
  {
    prop: 'lightmap_size_hint',
    valid: ['Vector2i(64, 64)'],
    invalid: [{ value: 'Vector2(64, 64)', contains: ['lightmap_size_hint'], severity: 'error' }],
  },
]);

describe('mesh base validators', () => {
  it('declare each property on the class the engine declares it on', () => {
    expect(validatorRegistry.getOwnKeys('PrimitiveMesh')).toContain('flip_faces');
    expect(validatorRegistry.getOwnKeys('Mesh')).toEqual(['lightmap_size_hint']);
    // PlaneMesh keeps only what primitive_meshes.cpp declares on PlaneMesh.
    expect(validatorRegistry.getOwnKeys('PlaneMesh')).not.toContain('flip_faces');
  });

  it('reach every procedural mesh, including the ones with no slice', () => {
    for (const type of ['BoxMesh', 'SphereMesh', 'TextMesh', 'QuadMesh']) {
      expect(validatorRegistry.findValidator(type, 'uv2_padding')).not.toBeNull();
    }
  });
});
