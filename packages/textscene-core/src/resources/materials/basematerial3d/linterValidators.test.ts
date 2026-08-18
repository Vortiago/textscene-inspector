/**
 * Tests for the BaseMaterial3D linter validators.
 *
 * Deliberately asked for through `StandardMaterial3D`, the leaf a scene names:
 * the properties are registered one hop up, so every lookup here also asserts
 * that the resource base-walk delivers them. The last block pins that directly.
 */

import { describe, it, expect } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { Linter } from '../../../linter/Linter';
import './linterValidators'; // Import to trigger registration

describe('BaseMaterial3D Linter Validators', () => {
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

  describe('emission_energy_multiplier validator', () => {
    it('should accept a non-negative value', () => {
      const validator = validatorRegistry.findValidator(
        'StandardMaterial3D',
        'emission_energy_multiplier'
      );
      expect(validator).not.toBeNull();
      expect(validator!('emission_energy_multiplier', '2.5', 1)).toBeNull();
    });

    it('should warn on a negative value', () => {
      // material.cpp:3634 ("0,16,0.01,or_greater"); set_emission_energy_multiplier
      // (:2196-2203) is a bare assignment, so out-of-range is a warning (ADR-0032).
      const validator = validatorRegistry.findValidator(
        'StandardMaterial3D',
        'emission_energy_multiplier'
      );
      const result = validator!('emission_energy_multiplier', '-1', 1);
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
    });
  });

  describe('emission_operator validator', () => {
    it('should accept 0 (ADD) and 1 (MULTIPLY)', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'emission_operator');
      expect(validator!('emission_operator', '0', 1)).toBeNull();
      expect(validator!('emission_operator', '1', 1)).toBeNull();
    });

    it('should warn on 2', () => {
      // material.cpp:3637, set_emission_operator (:3141-3146) is a bare assignment.
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'emission_operator');
      const result = validator!('emission_operator', '2', 1);
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
    });
  });

  describe('texture_filter validator', () => {
    it('should accept modes 0-5', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'texture_filter');
      for (let mode = 0; mode <= 5; mode++) {
        expect(validator!('texture_filter', String(mode), 1)).toBeNull();
      }
    });

    it('should warn on mode 6', () => {
      // material.cpp:3732, set_texture_filter (:2567-2570) is a bare assignment.
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'texture_filter');
      const result = validator!('texture_filter', '6', 1);
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
    });

    it('names BaseMaterial3D’s own constants, not another TextureFilter enum', () => {
      // Three engine enums carry the name. `CanvasItem::TextureFilter` prepends
      // PARENT_NODE at 0 and runs offset by one;
      // `Viewport::DefaultCanvasItemTextureFilter` swaps LINEAR_WITH_MIPMAPS and
      // NEAREST_WITH_MIPMAPS. Either would mislabel every value here.
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'texture_filter');
      const message = validator!('texture_filter', '6', 1)!.message;
      expect(message).toContain('2=NEAREST_WITH_MIPMAPS');
      expect(message).toContain('3=LINEAR_WITH_MIPMAPS');
      expect(message).toContain('0=NEAREST');
    });
  });

  describe('emission_intensity validator', () => {
    it('should accept a non-negative value', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'emission_intensity');
      expect(validator!('emission_intensity', '5000', 1)).toBeNull();
    });

    it('should warn on a negative value', () => {
      // material.cpp:3635 ("0,100000.0,0.01,or_greater,suffix:nt"); set_emission_intensity
      // (:2210-2214) gates on a project setting, not the value, so out-of-range warns.
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'emission_intensity');
      const result = validator!('emission_intensity', '-1', 1);
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
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

  describe('registered where Godot declares them', () => {
    it('registers on BaseMaterial3D, so a lookup on it resolves directly', () => {
      // The class the engine declares them on, and the key a guard reading
      // `class_get_property_list('BaseMaterial3D', true)` looks up. It resolved
      // to null while these sat on the leaf, so nothing could check them.
      expect(validatorRegistry.getOwnKeys('BaseMaterial3D')).toContain('albedo_color');
      expect(validatorRegistry.getOwnKeys('StandardMaterial3D')).toEqual([]);
    });

    it('reaches ORMMaterial3D, the sibling leaf that inherits the same set', () => {
      // ORMMaterial3D declares nothing of its own: everything it can carry is
      // BaseMaterial3D's, and it validated none of it before the base-walk
      // covered the Resource hierarchy.
      const validator = validatorRegistry.findValidator('ORMMaterial3D', 'albedo_color');
      expect(validator).not.toBeNull();
      expect(validator!('albedo_color', 'Color(1, 0)', 1)?.severity).toBe('error');
    });

    it('reports through the Linter on an ORMMaterial3D sub-resource', () => {
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="ORMMaterial3D" id="Material_1"]
uv1_scale = Vector2(0.5, 0.5)

[node name="Root" type="Node3D"]
`;
      const diagnostics = new Linter().lint(content);
      expect(
        diagnostics.filter((d) => d.severity === 'error' && d.message.includes('uv1_scale'))
      ).toHaveLength(1);
    });

    it('inherits Material keys through the base-walk without re-declaring them', () => {
      // Only this slice is imported here, so the ancestor resolves solely
      // because this module registers Material's chain on the way in.
      expect(validatorRegistry.findValidator('StandardMaterial3D', 'render_priority')).not.toBeNull();
      expect(validatorRegistry.getOwnKeys('BaseMaterial3D')).not.toContain('render_priority');
    });
  });
});
