/**
 * Tests for shared light parsing utilities
 */

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
      expect(result.shadow_filter).toBeUndefined();
    });

    it('should parse all base light properties', () => {
      const properties = {
        light_color: 'Color(1, 0.5, 0, 1)',
        light_energy: '2.5',
        shadow_enabled: 'true',
        shadow_bias: '0.05',
        shadow_filter: '2',
      };

      const result = parseBaseLightProperties(properties);

      expect(result.light_color).toBe('Color(1, 0.5, 0, 1)');
      expect(result.light_energy).toBe(2.5);
      expect(result.shadow_enabled).toBe(true);
      expect(result.shadow_bias).toBe(0.05);
      expect(result.shadow_filter).toBe(2);
    });

    it('should handle shadow_enabled false', () => {
      const result1 = parseBaseLightProperties({ shadow_enabled: 'false' });
      expect(result1.shadow_enabled).toBe(false);

      const result2 = parseBaseLightProperties({ shadow_enabled: '0' });
      expect(result2.shadow_enabled).toBe(false);

      const result3 = parseBaseLightProperties({});
      expect(result3.shadow_enabled).toBe(false);
    });

    it('should return NaN for invalid light_energy', () => {
      const result = parseBaseLightProperties({ light_energy: 'invalid' });
      expect(result.light_energy).toBeNaN();
    });

    it('should return NaN for invalid shadow_bias', () => {
      const result = parseBaseLightProperties({ shadow_bias: 'not-a-number' });
      expect(result.shadow_bias).toBeNaN();
    });

    it('should return NaN for invalid shadow_filter', () => {
      const result = parseBaseLightProperties({ shadow_filter: 'invalid' });
      expect(result.shadow_filter).toBeNaN();
    });

    it('should handle empty strings as falsy and return defaults', () => {
      const result = parseBaseLightProperties({
        light_energy: '',
        shadow_bias: '',
        shadow_filter: '',
      });

      expect(result.light_energy).toBe(1.0);
      expect(result.shadow_bias).toBeUndefined();
      expect(result.shadow_filter).toBeUndefined();
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
        shadow_filter: '2',
        shadow_normal_bias: '0.03',
      };

      const result = parseBaseLightWithNormalBias(properties);

      expect(result.light_color).toBe('Color(1, 0.9, 0.8, 1)');
      expect(result.light_energy).toBe(1.5);
      expect(result.shadow_enabled).toBe(true);
      expect(result.shadow_bias).toBe(0.05);
      expect(result.shadow_filter).toBe(2);
      expect(result.shadow_normal_bias).toBe(0.03);
    });

    it('should return undefined for missing shadow_normal_bias', () => {
      const result = parseBaseLightWithNormalBias({});
      expect(result.shadow_normal_bias).toBeUndefined();
    });

    it('should return NaN for invalid shadow_normal_bias', () => {
      const result = parseBaseLightWithNormalBias({ shadow_normal_bias: 'abc' });
      expect(result.shadow_normal_bias).toBeNaN();
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
