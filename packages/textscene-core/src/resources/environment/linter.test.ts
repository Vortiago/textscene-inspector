/**
 * Environment linter validator tests - tests validators directly
 */

import { describe, it, expect } from 'vitest';
import { validatorRegistry } from '../../linter/ValidatorRegistry';
import './linterValidators'; // Import to trigger registration

describe('Environment Linter Validators', () => {
  describe('background_mode validator', () => {
    it('should accept valid modes 0-5', () => {
      const validator = validatorRegistry.findValidator('Environment', 'background_mode');
      expect(validator).not.toBeNull();

      for (let mode = 0; mode <= 5; mode++) {
        const result = validator!('background_mode', mode.toString(), 1);
        expect(result).toBeNull();
      }
    });

    it('should reject invalid mode 99', () => {
      const validator = validatorRegistry.findValidator('Environment', 'background_mode');
      const result = validator!('background_mode', '99', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.message).toContain('must be an integer 0-5');
      expect(result!.code).toBe('INVALID_BACKGROUND_MODE');
    });

    it('should reject negative mode', () => {
      const validator = validatorRegistry.findValidator('Environment', 'background_mode');
      const result = validator!('background_mode', '-1', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('should reject non-numeric mode', () => {
      const validator = validatorRegistry.findValidator('Environment', 'background_mode');
      const result = validator!('background_mode', 'invalid', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('background_color validator', () => {
    it('should accept valid Color format', () => {
      const validator = validatorRegistry.findValidator('Environment', 'background_color');
      expect(validator).not.toBeNull();

      const result = validator!('background_color', 'Color(0.15, 0.12, 0.1, 1)', 1);
      expect(result).toBeNull();
    });

    it('should accept Color with spaces', () => {
      const validator = validatorRegistry.findValidator('Environment', 'background_color');
      const result = validator!('background_color', 'Color( 0.8 , 0.8 , 0.9 , 1 )', 1);
      expect(result).toBeNull();
    });

    it('should reject Color with missing alpha', () => {
      const validator = validatorRegistry.findValidator('Environment', 'background_color');
      const result = validator!('background_color', 'Color(1, 2, 3)', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.message).toContain('Color(r, g, b, a)');
      expect(result!.code).toBe('INVALID_COLOR_FORMAT');
    });

    it('should reject Color with too many components', () => {
      const validator = validatorRegistry.findValidator('Environment', 'background_color');
      const result = validator!('background_color', 'Color(1,2,3,4,5)', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('should reject invalid format', () => {
      const validator = validatorRegistry.findValidator('Environment', 'background_color');
      const result = validator!('background_color', 'NotAColor', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('should reject rgb format', () => {
      const validator = validatorRegistry.findValidator('Environment', 'background_color');
      const result = validator!('background_color', 'rgb(1, 2, 3)', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('volumetric_fog_enabled validator', () => {
    it('should accept "true"', () => {
      const validator = validatorRegistry.findValidator('Environment', 'volumetric_fog_enabled');
      expect(validator).not.toBeNull();

      const result = validator!('volumetric_fog_enabled', 'true', 1);
      expect(result).toBeNull();
    });

    it('should accept "false"', () => {
      const validator = validatorRegistry.findValidator('Environment', 'volumetric_fog_enabled');
      const result = validator!('volumetric_fog_enabled', 'false', 1);
      expect(result).toBeNull();
    });

    it('should reject "maybe"', () => {
      const validator = validatorRegistry.findValidator('Environment', 'volumetric_fog_enabled');
      const result = validator!('volumetric_fog_enabled', 'maybe', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.message).toContain('must be "true" or "false"');
      expect(result!.code).toBe('INVALID_BOOLEAN');
    });

    it('should reject numeric value', () => {
      const validator = validatorRegistry.findValidator('Environment', 'volumetric_fog_enabled');
      const result = validator!('volumetric_fog_enabled', '1', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('volumetric_fog_density validator', () => {
    it('should accept positive density', () => {
      const validator = validatorRegistry.findValidator('Environment', 'volumetric_fog_density');
      expect(validator).not.toBeNull();

      const result = validator!('volumetric_fog_density', '0.001', 1);
      expect(result).toBeNull();
    });

    it('should accept zero density', () => {
      const validator = validatorRegistry.findValidator('Environment', 'volumetric_fog_density');
      const result = validator!('volumetric_fog_density', '0', 1);
      expect(result).toBeNull();
    });

    it('should reject negative density', () => {
      const validator = validatorRegistry.findValidator('Environment', 'volumetric_fog_density');
      const result = validator!('volumetric_fog_density', '-0.5', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.message).toContain('must be a number >= 0');
      expect(result!.code).toBe('INVALID_NUMBER');
    });

    it('should reject non-numeric density', () => {
      const validator = validatorRegistry.findValidator('Environment', 'volumetric_fog_density');
      const result = validator!('volumetric_fog_density', 'invalid', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('volumetric_fog_albedo validator', () => {
    it('should accept valid Color format', () => {
      const validator = validatorRegistry.findValidator('Environment', 'volumetric_fog_albedo');
      expect(validator).not.toBeNull();

      const result = validator!('volumetric_fog_albedo', 'Color(0.8, 0.8, 0.9, 1)', 1);
      expect(result).toBeNull();
    });

    it('should reject invalid Color format', () => {
      const validator = validatorRegistry.findValidator('Environment', 'volumetric_fog_albedo');
      const result = validator!('volumetric_fog_albedo', 'NotAColor', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('adjustment_brightness validator', () => {
    it('should accept positive brightness', () => {
      const validator = validatorRegistry.findValidator('Environment', 'adjustment_brightness');
      expect(validator).not.toBeNull();

      const result = validator!('adjustment_brightness', '1.05', 1);
      expect(result).toBeNull();
    });

    it('should accept zero brightness', () => {
      const validator = validatorRegistry.findValidator('Environment', 'adjustment_brightness');
      const result = validator!('adjustment_brightness', '0', 1);
      expect(result).toBeNull();
    });

    it('should reject negative brightness', () => {
      const validator = validatorRegistry.findValidator('Environment', 'adjustment_brightness');
      const result = validator!('adjustment_brightness', '-0.5', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.message).toContain('must be a number >= 0');
      expect(result!.code).toBe('INVALID_NUMBER');
    });
  });

  describe('adjustment_enabled validator', () => {
    it('should accept "true"', () => {
      const validator = validatorRegistry.findValidator('Environment', 'adjustment_enabled');
      const result = validator!('adjustment_enabled', 'true', 1);
      expect(result).toBeNull();
    });

    it('should accept "false"', () => {
      const validator = validatorRegistry.findValidator('Environment', 'adjustment_enabled');
      const result = validator!('adjustment_enabled', 'false', 1);
      expect(result).toBeNull();
    });

    it('should reject invalid boolean', () => {
      const validator = validatorRegistry.findValidator('Environment', 'adjustment_enabled');
      const result = validator!('adjustment_enabled', 'yes', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('ssr_enabled validator', () => {
    it('should accept "true"', () => {
      const validator = validatorRegistry.findValidator('Environment', 'ssr_enabled');
      const result = validator!('ssr_enabled', 'true', 1);
      expect(result).toBeNull();
    });

    it('should accept "false"', () => {
      const validator = validatorRegistry.findValidator('Environment', 'ssr_enabled');
      const result = validator!('ssr_enabled', 'false', 1);
      expect(result).toBeNull();
    });

    it('should reject invalid boolean', () => {
      const validator = validatorRegistry.findValidator('Environment', 'ssr_enabled');
      const result = validator!('ssr_enabled', 'on', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });
});
