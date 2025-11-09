/**
 * Tests for StandardMaterial3D linter validators
 */

import { describe, it, expect } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import './linterParser'; // Import to trigger registration

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
      expect(result!.message).toContain('must be "true" or "false"');
      expect(result!.code).toBe('INVALID_BOOLEAN');
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
      expect(result!.message).toContain('must be "true" or "false"');
      expect(result!.code).toBe('INVALID_BOOLEAN');
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

    it('should reject invalid ExtResource format', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'normal_texture');
      const result = validator!('normal_texture', 'ExtResource(1_abc)', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.message).toContain('must be an ExtResource reference');
      expect(result!.code).toBe('INVALID_EXTRESOURCE');
    });

    it('should reject SubResource reference', () => {
      const validator = validatorRegistry.findValidator('StandardMaterial3D', 'normal_texture');
      const result = validator!('normal_texture', 'SubResource("Material_1")', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
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
});
