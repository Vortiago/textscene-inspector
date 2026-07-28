/**
 * Tests for StandardMaterial3D linter validators
 */

import { describe, it, expect } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { Linter } from '../../../linter/Linter';
import './linterValidators'; // Import to trigger registration

describe('StandardMaterial3D Linter Validators', () => {
  describe('normal_enabled validator', () => {
    it('should accept "true"', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'normal_enabled');
      expect(validator).not.toBeNull();

      const result = validator!('normal_enabled', 'true', 1);
      expect(result).toBeNull();
    });

    it('should accept "false"', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'normal_enabled');
      const result = validator!('normal_enabled', 'false', 1);
      expect(result).toBeNull();
    });

    it('should reject invalid boolean', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'normal_enabled');
      const result = validator!('normal_enabled', 'yes', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.message).toContain('must be a boolean (true or false)');
      expect(result!.code).toBe('INVALID_NORMAL_ENABLED_FORMAT');
    });

    it('should reject numeric value', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'normal_enabled');
      const result = validator!('normal_enabled', '1', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('emission_enabled validator', () => {
    it('should accept "true"', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'emission_enabled');
      expect(validator).not.toBeNull();

      const result = validator!('emission_enabled', 'true', 1);
      expect(result).toBeNull();
    });

    it('should reject invalid boolean', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'emission_enabled');
      const result = validator!('emission_enabled', 'on', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.message).toContain('must be a boolean (true or false)');
      expect(result!.code).toBe('INVALID_EMISSION_ENABLED_FORMAT');
    });
  });

  describe('refraction_enabled validator', () => {
    it('should accept "true"', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'refraction_enabled');
      expect(validator).not.toBeNull();

      const result = validator!('refraction_enabled', 'true', 1);
      expect(result).toBeNull();
    });

    it('should reject invalid boolean', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'refraction_enabled');
      const result = validator!('refraction_enabled', 'yes', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.message).toContain('must be a boolean (true or false)');
      expect(result!.code).toBe('INVALID_REFRACTION_ENABLED_FORMAT');
    });
  });

  describe('anisotropy_enabled validator', () => {
    it('should accept "true"', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'anisotropy_enabled');
      expect(validator).not.toBeNull();

      const result = validator!('anisotropy_enabled', 'true', 1);
      expect(result).toBeNull();
    });

    it('should reject invalid boolean', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'anisotropy_enabled');
      const result = validator!('anisotropy_enabled', 'yes', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.message).toContain('must be a boolean (true or false)');
      expect(result!.code).toBe('INVALID_ANISOTROPY_ENABLED_FORMAT');
    });
  });

  describe('normal_texture validator', () => {
    it('should accept valid ExtResource reference', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'normal_texture');
      expect(validator).not.toBeNull();

      const result = validator!('normal_texture', 'ExtResource("1_abc")', 1);
      expect(result).toBeNull();
    });

    it('should accept ExtResource with underscore and numbers', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'normal_texture');
      const result = validator!('normal_texture', 'ExtResource("2_normal")', 1);
      expect(result).toBeNull();
    });

    it('should reject a malformed reference (missing quotes)', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'normal_texture');
      const result = validator!('normal_texture', 'ExtResource(1_abc)', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.message).toContain('must be a resource reference');
      expect(result!.code).toBe('INVALID_NORMAL_TEXTURE_REFERENCE');
    });

    it('should accept a SubResource reference (procedural/inline Texture2D)', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'normal_texture');
      const result = validator!('normal_texture', 'SubResource("Tex_1")', 1);

      expect(result).toBeNull();
    });

    it('should reject plain string', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'normal_texture');
      const result = validator!('normal_texture', 'res://texture.png', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('albedo_texture validator', () => {
    it('should accept valid ExtResource reference', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'albedo_texture');
      expect(validator).not.toBeNull();

      const result = validator!('albedo_texture', 'ExtResource("3_albedo")', 1);
      expect(result).toBeNull();
    });

    it('should reject invalid format', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'albedo_texture');
      const result = validator!('albedo_texture', 'invalid', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('metallic_texture validator', () => {
    it('should accept valid ExtResource reference', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'metallic_texture');
      const result = validator!('metallic_texture', 'ExtResource("4_metallic")', 1);
      expect(result).toBeNull();
    });
  });

  describe('roughness_texture validator', () => {
    it('should accept valid ExtResource reference', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'roughness_texture');
      const result = validator!('roughness_texture', 'ExtResource("5_roughness")', 1);
      expect(result).toBeNull();
    });
  });

  describe('ao_texture validator', () => {
    it('should accept valid ExtResource reference', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'ao_texture');
      const result = validator!('ao_texture', 'ExtResource("6_ao")', 1);
      expect(result).toBeNull();
    });
  });

  describe('emission_texture validator', () => {
    it('should accept valid ExtResource reference', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'emission_texture');
      const result = validator!('emission_texture', 'ExtResource("7_emission")', 1);
      expect(result).toBeNull();
    });
  });

  describe('uv1_scale validator', () => {
    it('should accept valid Vector3 format', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'uv1_scale');
      expect(validator).not.toBeNull();

      const result = validator!('uv1_scale', 'Vector3(0.5, 0.5, 0.5)', 1);
      expect(result).toBeNull();
    });

    it('should accept Vector3 with different values', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'uv1_scale');
      const result = validator!('uv1_scale', 'Vector3(2.4, 1.5, 1)', 1);
      expect(result).toBeNull();
    });

    it('should accept Vector3 with spaces', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'uv1_scale');
      const result = validator!('uv1_scale', 'Vector3( 1 , 2 , 3 )', 1);
      expect(result).toBeNull();
    });

    it('should accept Vector3 with negative values', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'uv1_scale');
      const result = validator!('uv1_scale', 'Vector3(-1, -2, -3)', 1);
      expect(result).toBeNull();
    });

    it('should accept Vector3 with decimal values', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'uv1_scale');
      const result = validator!('uv1_scale', 'Vector3(0.123, 4.567, 8.9)', 1);
      expect(result).toBeNull();
    });

    it('should reject invalid Vector3 format', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'uv1_scale');
      const result = validator!('uv1_scale', 'Invalid', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.message).toContain('must be Vector3 with 3 numbers');
      expect(result!.code).toBe('INVALID_UV1_SCALE_FORMAT');
    });

    it('should reject Vector3 with wrong number of components', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'uv1_scale');
      const result = validator!('uv1_scale', 'Vector3(1, 2)', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.code).toBe('INVALID_UV1_SCALE_FORMAT');
    });

    it('should reject Vector3 with non-numeric values', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'uv1_scale');
      const result = validator!('uv1_scale', 'Vector3(a, b, c)', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('should accept Vector3 with zero components (format is valid)', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'uv1_scale');
      const result = validator!('uv1_scale', 'Vector3(0, 1, 1)', 1);

      expect(result).toBeNull(); // Format is valid, semantic check could be a separate lint rule
    });

    it('should accept Vector3 with all zero components (format is valid)', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'uv1_scale');
      const result = validator!('uv1_scale', 'Vector3(0, 0, 0)', 1);

      expect(result).toBeNull(); // Format is valid
    });

    it('should reject Vector2 format', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'uv1_scale');
      const result = validator!('uv1_scale', 'Vector2(1, 1)', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('should accept Vector3 with scientific notation (Godot emits exponents)', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'uv1_scale');
      const result = validator!('uv1_scale', 'Vector3(1e-5, 2e3, 1)', 1);

      expect(result).toBeNull();
    });

    it('should reject Vector3 with missing opening parenthesis', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'uv1_scale');
      const result = validator!('uv1_scale', 'Vector3 1, 2, 3)', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('should reject Vector3 with missing closing parenthesis', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'uv1_scale');
      const result = validator!('uv1_scale', 'Vector3(1, 2, 3', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('should reject Vector3 with extra commas', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'uv1_scale');
      const result = validator!('uv1_scale', 'Vector3(1,, 2, 3)', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('should accept very large values', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'uv1_scale');
      const result = validator!('uv1_scale', 'Vector3(999999, 999999, 999999)', 1);

      expect(result).toBeNull();
    });

    it('should accept very small decimal values', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'uv1_scale');
      const result = validator!('uv1_scale', 'Vector3(0.00001, 0.00001, 0.00001)', 1);

      expect(result).toBeNull();
    });
  });

  describe('uv1_scale integration with Linter', () => {
    it('should validate valid uv1_scale in StandardMaterial3D SubResource', () => {
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="StandardMaterial3D" id="Material_1"]
uv1_scale = Vector3(0.5, 0.5, 0.5)

[node name="Root" type="Node3D"]
`;

      const linter = new Linter();
      const diagnostics = linter.lint(content);

      // Should have no errors for valid uv1_scale
      const uv1ScaleErrors = diagnostics.filter(d =>
        d.message.includes('uv1_scale')
      );
      expect(uv1ScaleErrors).toHaveLength(0);
    });

    it('should detect invalid uv1_scale format in StandardMaterial3D SubResource', () => {
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="StandardMaterial3D" id="Material_1"]
uv1_scale = Invalid

[node name="Root" type="Node3D"]
`;

      const linter = new Linter();
      const diagnostics = linter.lint(content);

      // Should have error for invalid uv1_scale format
      const uv1ScaleErrors = diagnostics.filter(d =>
        d.message.includes('uv1_scale') && d.message.includes('Vector3')
      );
      expect(uv1ScaleErrors.length).toBeGreaterThan(0);
      expect(uv1ScaleErrors[0]!.severity).toBe('error');
    });

    it('should detect Vector2 used instead of Vector3 for uv1_scale', () => {
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="StandardMaterial3D" id="Material_1"]
uv1_scale = Vector2(0.5, 0.5)

[node name="Root" type="Node3D"]
`;

      const linter = new Linter();
      const diagnostics = linter.lint(content);

      const uv1ScaleErrors = diagnostics.filter(d =>
        d.message.includes('uv1_scale')
      );
      expect(uv1ScaleErrors.length).toBeGreaterThan(0);
      expect(uv1ScaleErrors[0]!.severity).toBe('error');
    });

    it('should validate complex material with multiple properties including uv1_scale', () => {
      const content = `[gd_scene load_steps=3 format=3]

[ext_resource type="Texture2D" path="res://texture.png" id="1"]

[sub_resource type="StandardMaterial3D" id="Material_1"]
albedo_texture = ExtResource("1")
normal_enabled = true
uv1_scale = Vector3(2.0, 2.0, 1.0)
metallic = 0.5
roughness = 0.3

[node name="Root" type="Node3D"]
`;

      const linter = new Linter();
      const diagnostics = linter.lint(content);

      // Should have no errors - all properties are valid
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should validate uv1_scale with zero components (format valid, semantic warning could be added later)', () => {
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="StandardMaterial3D" id="Material_1"]
uv1_scale = Vector3(0, 0, 0)

[node name="Root" type="Node3D"]
`;

      const linter = new Linter();
      const diagnostics = linter.lint(content);

      // Format is valid, no parse errors
      const parseErrors = diagnostics.filter(d =>
        d.message.includes('uv1_scale') && d.severity === 'error'
      );
      expect(parseErrors).toHaveLength(0);
    });

    it('should handle missing commas in Vector3', () => {
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="StandardMaterial3D" id="Material_1"]
uv1_scale = Vector3(0.5 0.5 0.5)

[node name="Root" type="Node3D"]
`;

      const linter = new Linter();
      const diagnostics = linter.lint(content);

      const uv1ScaleErrors = diagnostics.filter(d =>
        d.message.includes('uv1_scale')
      );
      expect(uv1ScaleErrors.length).toBeGreaterThan(0);
      expect(uv1ScaleErrors[0]!.severity).toBe('error');
    });
  });
});
