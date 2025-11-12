/**
 * Tests for PlaneMesh linter validators
 */

import { describe, it, expect } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { Linter } from '../../../linter/Linter';
import './linterParser'; // Import to trigger registration

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
      expect(result!.message).toContain('must be "true" or "false"');
      expect(result!.code).toBe('INVALID_BOOLEAN');
    });

    it('should reject numeric value "1"', () => {
      const validator = validatorRegistry.findValidator('PlaneMesh', 'flip_faces');
      const result = validator!('flip_faces', '1', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.message).toContain('must be "true" or "false"');
      expect(result!.code).toBe('INVALID_BOOLEAN');
    });

    it('should reject numeric value "0"', () => {
      const validator = validatorRegistry.findValidator('PlaneMesh', 'flip_faces');
      const result = validator!('flip_faces', '0', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('should reject string "True" (wrong capitalization)', () => {
      const validator = validatorRegistry.findValidator('PlaneMesh', 'flip_faces');
      const result = validator!('flip_faces', 'True', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.message).toContain('must be "true" or "false"');
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

      // Should have no errors for valid flip_faces
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
        d.message.includes('flip_faces') && d.message.includes('must be "true" or "false"')
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
      expect(flipFacesErrors[0]!.severity).toBe('error');
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

      // Should have no errors - all properties are valid
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
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
