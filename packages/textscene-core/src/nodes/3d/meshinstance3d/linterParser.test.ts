/**
 * MeshInstance3D strict validators: format and bound checks.
 *
 * `blend_shapes/<name>` is the hand-rolled route
 * propertyListRouteCoverage.test.ts tracks — see linterParser.ts's header.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('MeshInstance3D', property);
  expect(validator, `no validator resolved for MeshInstance3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('MeshInstance3D strict validators', () => {
  describe('mesh / skeleton / skin / surface_material_override', () => {
    it('accepts a resource reference for mesh', () => {
      expect(check('mesh', 'SubResource("BoxMesh_1")')).toBeNull();
    });

    it('accepts a NodePath for skeleton', () => {
      expect(check('skeleton', 'NodePath("../Skeleton3D")')).toBeNull();
    });

    it('accepts a resource reference for skin', () => {
      expect(check('skin', 'SubResource("Skin_1")')).toBeNull();
    });

    it('accepts a resource reference for any surface_material_override index', () => {
      expect(check('surface_material_override/0', 'SubResource("StandardMaterial3D_1")')).toBeNull();
      expect(check('surface_material_override/5', 'ExtResource("mat")')).toBeNull();
    });
  });

  describe('blend_shapes/<name>', () => {
    it('accepts a value inside the -1..1 hint', () => {
      expect(check('blend_shapes/Smile', '0.5')).toBeNull();
      expect(check('blend_shapes/Smile', '-1')).toBeNull();
      expect(check('blend_shapes/Smile', '1')).toBeNull();
    });

    it('warns rather than errors outside the hint (mesh_instance_3d.cpp:103, set_blend_shape_value has no clamp)', () => {
      const error = check('blend_shapes/Smile', '1.5');
      expect(error?.severity).toBe('warning');
      expect(error?.message).toContain('blend_shapes');
    });

    it('rejects a non-numeric value', () => {
      expect(check('blend_shapes/Smile', 'not-a-float')?.severity).toBe('error');
    });

    it('resolves any blend-shape name, since the family is dynamic', () => {
      expect(check('blend_shapes/AnotherShapeEntirely', '0')).toBeNull();
    });
  });
});
