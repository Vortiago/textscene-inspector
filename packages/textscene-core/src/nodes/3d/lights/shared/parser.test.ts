/** Shared light parsing. */

import { describe, it, expect } from 'vitest';
import { parseBaseLightProperties, parseBaseLightWithNormalBias } from './parser';

describe('Base Light Parser', () => {
  describe('parseBaseLightProperties', () => {
    it('should parse defaults when no properties provided', () => {
      const result = parseBaseLightProperties({});

      expect(result.light_color).toBe('Color(1, 1, 1, 1)');
      expect(result.light_energy).toBe(1.0);
      expect(result.shadow_enabled).toBe(false);
      expect(result.shadow_bias).toBeUndefined();
      expect(result.shadow_blur).toBeUndefined();
      expect(result.light_negative).toBeUndefined();
      expect(result.light_specular).toBeUndefined();
      expect(result.light_volumetric_fog_energy).toBeUndefined();
    });

    it('should parse all base light properties', () => {
      const properties = {
        light_color: 'Color(1, 0.5, 0, 1)',
        light_energy: '2.5',
        shadow_enabled: 'true',
        shadow_bias: '0.05',
        shadow_blur: '3.0',
      };

      const result = parseBaseLightProperties(properties);

      expect(result.light_color).toBe('Color(1, 0.5, 0, 1)');
      expect(result.light_energy).toBe(2.5);
      expect(result.shadow_enabled).toBe(true);
      expect(result.shadow_bias).toBe(0.05);
      expect(result.shadow_blur).toBe(3.0);
    });

    it('should parse the witnessed Light3D base properties (previously dropped)', () => {
      const result = parseBaseLightProperties({
        light_negative: 'true',
        light_specular: '0.0',
        light_volumetric_fog_energy: '500.0',
        shadow_blur: '1.5',
      });

      expect(result.light_negative).toBe(true);
      expect(result.light_specular).toBe(0.0);
      expect(result.light_volumetric_fog_energy).toBe(500.0);
      expect(result.shadow_blur).toBe(1.5);
    });

    it('should default light_negative to false when the key is present as false', () => {
      const result = parseBaseLightProperties({ light_negative: 'false' });
      expect(result.light_negative).toBe(false);
    });

    it('should handle shadow_enabled false', () => {
      const result1 = parseBaseLightProperties({ shadow_enabled: 'false' });
      expect(result1.shadow_enabled).toBe(false);

      const result2 = parseBaseLightProperties({ shadow_enabled: '0' });
      expect(result2.shadow_enabled).toBe(false);

      const result3 = parseBaseLightProperties({});
      expect(result3.shadow_enabled).toBe(false);
    });

    it('should fall back to default 1.0 for invalid light_energy', () => {
      const result = parseBaseLightProperties({ light_energy: 'invalid' });
      expect(result.light_energy).toBe(1.0);
    });

    it('should be undefined for invalid shadow_bias', () => {
      const result = parseBaseLightProperties({ shadow_bias: 'not-a-number' });
      expect(result.shadow_bias).toBeUndefined();
    });

    it('should be undefined for invalid shadow_blur', () => {
      const result = parseBaseLightProperties({ shadow_blur: 'invalid' });
      expect(result.shadow_blur).toBeUndefined();
    });

    it('should handle empty strings as falsy and return defaults', () => {
      const result = parseBaseLightProperties({
        light_energy: '',
        shadow_bias: '',
        shadow_blur: '',
      });

      expect(result.light_energy).toBe(1.0);
      expect(result.shadow_bias).toBeUndefined();
      expect(result.shadow_blur).toBeUndefined();
    });

    it('should handle negative values', () => {
      const result = parseBaseLightProperties({
        light_energy: '-1.5',
        shadow_bias: '-0.1',
      });

      expect(result.light_energy).toBe(-1.5);
      expect(result.shadow_bias).toBe(-0.1);
    });

    it('should handle fractional values', () => {
      const result = parseBaseLightProperties({
        light_energy: '0.75',
        shadow_bias: '0.001',
      });

      expect(result.light_energy).toBe(0.75);
      expect(result.shadow_bias).toBe(0.001);
    });

    it('should handle extremely large numeric values', () => {
      const result = parseBaseLightProperties({
        light_energy: '999999999.999',
      });

      expect(result.light_energy).toBe(999999999.999);
    });

    it('should accept any string for light_color', () => {
      const result = parseBaseLightProperties({ light_color: 'invalid-color' });
      expect(result.light_color).toBe('invalid-color');
    });

    it('should use custom light_color when provided', () => {
      const result = parseBaseLightProperties({ light_color: 'Color(1, 0.95, 0.8, 1)' });
      expect(result.light_color).toBe('Color(1, 0.95, 0.8, 1)');
    });
  });

  describe('parseBaseLightWithNormalBias', () => {
    it('should include shadow_normal_bias', () => {
      const properties = {
        shadow_normal_bias: '0.02',
      };

      const result = parseBaseLightWithNormalBias(properties);

      expect(result.shadow_normal_bias).toBe(0.02);
    });

    it('should inherit all base properties', () => {
      const properties = {
        light_color: 'Color(1, 0.9, 0.8, 1)',
        light_energy: '1.5',
        shadow_enabled: 'true',
        shadow_bias: '0.05',
        shadow_blur: '2',
        shadow_normal_bias: '0.03',
      };

      const result = parseBaseLightWithNormalBias(properties);

      expect(result.light_color).toBe('Color(1, 0.9, 0.8, 1)');
      expect(result.light_energy).toBe(1.5);
      expect(result.shadow_enabled).toBe(true);
      expect(result.shadow_bias).toBe(0.05);
      expect(result.shadow_blur).toBe(2);
      expect(result.shadow_normal_bias).toBe(0.03);
    });

    it('should return undefined for missing shadow_normal_bias', () => {
      const result = parseBaseLightWithNormalBias({});
      expect(result.shadow_normal_bias).toBeUndefined();
    });

    it('should return undefined for invalid shadow_normal_bias', () => {
      const result = parseBaseLightWithNormalBias({ shadow_normal_bias: 'abc' });
      expect(result.shadow_normal_bias).toBeUndefined();
    });

    it('should handle negative shadow_normal_bias', () => {
      const result = parseBaseLightWithNormalBias({ shadow_normal_bias: '-0.05' });
      expect(result.shadow_normal_bias).toBe(-0.05);
    });

    it('should handle fractional shadow_normal_bias', () => {
      const result = parseBaseLightWithNormalBias({ shadow_normal_bias: '0.005' });
      expect(result.shadow_normal_bias).toBe(0.005);
    });
  });
});
