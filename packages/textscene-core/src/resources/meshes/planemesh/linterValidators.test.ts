/**
 * PlaneMesh linter validators, own and inherited. The full barrel, not
 * `./linterValidators`: `flip_faces` is PrimitiveMesh's, and this slice alone
 * does not load the class that declares it.
 */

import { describe, it, expect } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { Linter } from '../../../linter/Linter';
import { runResourcePropertyValidation } from '../../../linter/testing/testkit.js';
import '../../../linter/index';

runResourcePropertyValidation('PlaneMesh', [
  {
    prop: 'subdivide_width',
    valid: ['0', '100', '512'],
    // `p_divisions > 0 ? p_divisions : 0` stores 0 for a negative
    // (primitive_meshes.cpp:1543), so the value written is not the value kept.
    invalid: [{ value: '-1', contains: ['subdivide_width'], severity: 'error' }],
  },
  {
    prop: 'subdivide_depth',
    valid: ['0', '7'],
    invalid: [{ value: '-4', contains: ['subdivide_depth'], severity: 'error' }],
  },
  {
    prop: 'orientation',
    valid: ['0', '1', '2'],
    // A bare assignment (primitive_meshes.cpp:1575), so an unlisted orientation
    // is stored as written and only the inspector's list disagrees.
    invalid: [{ value: '3', contains: ['orientation'], severity: 'warning' }],
  },
]);

describe('PlaneMesh Linter Validators', () => {
  describe('flip_faces validator', () => {
    it('should accept "true"', () => {
      const validator = validatorRegistry.findValidator('PlaneMesh', 'flip_faces');
      expect(validator).not.toBeNull();

      const result = validator!('flip_faces', 'true', 1);
      expect(result).toBeNull();
    });

    it('should accept "false"', () => {
      const validator = validatorRegistry.findValidator('PlaneMesh', 'flip_faces');
      const result = validator!('flip_faces', 'false', 1);
      expect(result).toBeNull();
    });

    it('should reject invalid boolean value "yes"', () => {
      const validator = validatorRegistry.findValidator('PlaneMesh', 'flip_faces');
      const result = validator!('flip_faces', 'yes', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.message).toContain('must be a boolean (true or false)');
      expect(result!.code).toBe('INVALID_FLIP_FACES_FORMAT');
    });

    it('should reject numeric value "1"', () => {
      const validator = validatorRegistry.findValidator('PlaneMesh', 'flip_faces');
      const result = validator!('flip_faces', '1', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
      expect(result!.message).toContain('converts');
      expect(result!.code).toBe('INVALID_FLIP_FACES_FORMAT');
    });

    it('should reject numeric value "0"', () => {
      const validator = validatorRegistry.findValidator('PlaneMesh', 'flip_faces');
      const result = validator!('flip_faces', '0', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
    });

    it('should reject string "True" (wrong capitalization)', () => {
      const validator = validatorRegistry.findValidator('PlaneMesh', 'flip_faces');
      const result = validator!('flip_faces', 'True', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.message).toContain('must be a boolean (true or false)');
    });

    it('should reject string "FALSE" (wrong capitalization)', () => {
      const validator = validatorRegistry.findValidator('PlaneMesh', 'flip_faces');
      const result = validator!('flip_faces', 'FALSE', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('flip_faces integration with Linter', () => {
    it('should validate PlaneMesh with flip_faces = true', () => {
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="PlaneMesh" id="Mesh_1"]
flip_faces = true

[node name="Root" type="Node3D"]
`;

      const linter = new Linter();
      const diagnostics = linter.lint(content);

      const flipFacesErrors = diagnostics.filter(d =>
        d.message.includes('flip_faces')
      );
      expect(flipFacesErrors).toHaveLength(0);
    });

    it('should validate PlaneMesh with flip_faces = false', () => {
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="PlaneMesh" id="Mesh_1"]
flip_faces = false

[node name="Root" type="Node3D"]
`;

      const linter = new Linter();
      const diagnostics = linter.lint(content);

      const flipFacesErrors = diagnostics.filter(d =>
        d.message.includes('flip_faces')
      );
      expect(flipFacesErrors).toHaveLength(0);
    });

    it('should detect invalid flip_faces value', () => {
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="PlaneMesh" id="Mesh_1"]
flip_faces = yes

[node name="Root" type="Node3D"]
`;

      const linter = new Linter();
      const diagnostics = linter.lint(content);

      const flipFacesErrors = diagnostics.filter(d =>
        d.message.includes('flip_faces') && d.message.includes('must be a boolean (true or false)')
      );
      expect(flipFacesErrors.length).toBeGreaterThan(0);
      expect(flipFacesErrors[0]!.severity).toBe('error');
    });

    it('should detect numeric value used for flip_faces', () => {
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="PlaneMesh" id="Mesh_1"]
flip_faces = 1

[node name="Root" type="Node3D"]
`;

      const linter = new Linter();
      const diagnostics = linter.lint(content);

      const flipFacesErrors = diagnostics.filter(d =>
        d.message.includes('flip_faces')
      );
      expect(flipFacesErrors.length).toBeGreaterThan(0);
      expect(flipFacesErrors[0]!.severity).toBe('warning');
    });

    it('should validate PlaneMesh with multiple properties including flip_faces', () => {
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="PlaneMesh" id="Mesh_1"]
size = Vector2(10, 5)
subdivide_width = 10
subdivide_depth = 5
orientation = 2
flip_faces = true

[node name="Root" type="Node3D"]
`;

      const linter = new Linter();
      const diagnostics = linter.lint(content);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should detect a malformed size vector (parity with QuadMesh)', () => {
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="PlaneMesh" id="Mesh_1"]
size = Vector2(10)

[node name="Root" type="Node3D"]
`;

      const linter = new Linter();
      const errors = linter.lint(content).filter((d) => d.severity === 'error');
      expect(errors.some((d) => d.message.includes('size'))).toBe(true);
    });

    it('should detect wrong capitalization in flip_faces value', () => {
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="PlaneMesh" id="Mesh_1"]
flip_faces = True

[node name="Root" type="Node3D"]
`;

      const linter = new Linter();
      const diagnostics = linter.lint(content);

      const flipFacesErrors = diagnostics.filter(d =>
        d.message.includes('flip_faces')
      );
      expect(flipFacesErrors.length).toBeGreaterThan(0);
      expect(flipFacesErrors[0]!.severity).toBe('error');
    });
  });
});
