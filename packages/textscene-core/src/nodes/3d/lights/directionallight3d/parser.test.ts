/** DirectionalLight3D parser. */

import { describe, it, expect } from 'vitest';
import { parseDirectionalLight3D } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

describe('DirectionalLight3D Parser', () => {
  describe('parseDirectionalLight3D', () => {
    it('should parse basic DirectionalLight3D with defaults', () => {
      const h = heading('DirectionalLight3D', { name: 'DirectionalLight', parent: '.' });

      const result = parseDirectionalLight3D(h, {});

      expect(result.name).toBe('DirectionalLight');
      expect(result.parent).toBe('.');
      expect(result.light_color).toBe('Color(1, 1, 1, 1)');
      expect(result.light_energy).toBe(1.0);
      expect(result.shadow_enabled).toBe(false);
      expect(result.shadow_bias).toBeUndefined();
      expect(result.shadow_normal_bias).toBeUndefined();
      expect(result.shadow_blur).toBeUndefined();
      expect(result.directional_shadow_mode).toBeUndefined();
      expect(result.directional_shadow_max_distance).toBeUndefined();
    });

    it('should parse DirectionalLight3D with all properties', () => {
      const h = heading('DirectionalLight3D', { name: 'Sun', parent: '.' });

      const properties = {
        light_color: 'Color(1, 0.95, 0.8, 1)',
        light_energy: '1.5',
        shadow_enabled: 'true',
        shadow_bias: '0.05',
        shadow_normal_bias: '0.02',
        shadow_blur: '2',
        directional_shadow_mode: '2',
        directional_shadow_max_distance: '100.0',
      };

      const result = parseDirectionalLight3D(h, properties);

      expect(result.name).toBe('Sun');
      expect(result.light_color).toBe('Color(1, 0.95, 0.8, 1)');
      expect(result.light_energy).toBe(1.5);
      expect(result.shadow_enabled).toBe(true);
      expect(result.shadow_bias).toBe(0.05);
      expect(result.shadow_normal_bias).toBe(0.02);
      expect(result.shadow_blur).toBe(2);
      expect(result.directional_shadow_mode).toBe(2);
      expect(result.directional_shadow_max_distance).toBe(100.0);
    });

    it('should parse shadow_enabled as false when not "true"', () => {
      const h = heading('DirectionalLight3D', { name: 'Sun', parent: '.' });

      const result1 = parseDirectionalLight3D(h, { shadow_enabled: 'false' });
      expect(result1.shadow_enabled).toBe(false);

      const result2 = parseDirectionalLight3D(h, { shadow_enabled: '0' });
      expect(result2.shadow_enabled).toBe(false);

      const result3 = parseDirectionalLight3D(h, {});
      expect(result3.shadow_enabled).toBe(false);
    });

    it('should handle fractional values', () => {
      const h = heading('DirectionalLight3D', { name: 'Sun', parent: '.' });

      const properties = {
        light_energy: '0.75',
        shadow_bias: '0.001',
        shadow_normal_bias: '0.005',
        directional_shadow_max_distance: '150.5',
      };

      const result = parseDirectionalLight3D(h, properties);

      expect(result.light_energy).toBe(0.75);
      expect(result.shadow_bias).toBe(0.001);
      expect(result.shadow_normal_bias).toBe(0.005);
      expect(result.directional_shadow_max_distance).toBe(150.5);
    });

    it('should parse transform property from Node3D', () => {
      const h = heading('DirectionalLight3D', { name: 'Sun', parent: '.' });

      const properties = {
        transform: 'Transform3D(1, 0, 0, 0, 0.707107, 0.707107, 0, -0.707107, 0.707107, 0, 5, 0)',
        light_energy: '1.2',
      };

      const result = parseDirectionalLight3D(h, properties);

      expect(result.transform).toBeDefined();
      expect(result.transform?.origin.x).toBe(0);
      expect(result.transform?.origin.y).toBe(5);
      expect(result.transform?.origin.z).toBe(0);
      expect(result.light_energy).toBe(1.2);
    });

    it('should parse light with parent hierarchy', () => {
      const h = heading('DirectionalLight3D', { name: 'Sun', parent: 'Environment' });

      const result = parseDirectionalLight3D(h, { light_energy: '2.0' });

      expect(result.name).toBe('Sun');
      expect(result.parent).toBe('Environment');
      expect(result.light_energy).toBe(2.0);
    });

    it('should parse directional_shadow_mode values', () => {
      const h = heading('DirectionalLight3D', { name: 'Sun', parent: '.' });

      const modes = [
        { value: '0', expected: 0 }, // SHADOW_ORTHOGONAL_SPLIT_1
        { value: '1', expected: 1 }, // SHADOW_ORTHOGONAL_SPLIT_2
        { value: '2', expected: 2 }, // SHADOW_ORTHOGONAL_SPLIT_4
      ];

      modes.forEach(({ value, expected }) => {
        const result = parseDirectionalLight3D(h, { directional_shadow_mode: value });
        expect(result.directional_shadow_mode).toBe(expected);
      });
    });
  });

  describe('Error Path Testing', () => {
    it('should fall back to default 1.0 for invalid light_energy', () => {
      const h = heading('DirectionalLight3D', { name: 'Light', parent: '.' });
      const result = parseDirectionalLight3D(h, { light_energy: 'invalid' });
      expect(result.light_energy).toBe(1.0);
    });

    it('should be undefined for invalid shadow_bias', () => {
      const h = heading('DirectionalLight3D', { name: 'Light', parent: '.' });
      const result = parseDirectionalLight3D(h, { shadow_bias: 'not-a-number' });
      expect(result.shadow_bias).toBeUndefined();
    });

    it('should be undefined for invalid shadow_normal_bias', () => {
      const h = heading('DirectionalLight3D', { name: 'Light', parent: '.' });
      const result = parseDirectionalLight3D(h, { shadow_normal_bias: 'abc' });
      expect(result.shadow_normal_bias).toBeUndefined();
    });

    it('should be undefined for invalid directional_shadow_max_distance', () => {
      const h = heading('DirectionalLight3D', { name: 'Light', parent: '.' });
      const result = parseDirectionalLight3D(h, { directional_shadow_max_distance: 'xyz' });
      expect(result.directional_shadow_max_distance).toBeUndefined();
    });

    it('should be undefined for invalid shadow_blur', () => {
      const h = heading('DirectionalLight3D', { name: 'Light', parent: '.' });
      const result = parseDirectionalLight3D(h, { shadow_blur: 'invalid' });
      expect(result.shadow_blur).toBeUndefined();
    });

    it('should be undefined for invalid directional_shadow_mode', () => {
      const h = heading('DirectionalLight3D', { name: 'Light', parent: '.' });
      const result = parseDirectionalLight3D(h, { directional_shadow_mode: 'bad' });
      expect(result.directional_shadow_mode).toBeUndefined();
    });

    it('should handle empty strings as falsy and return defaults', () => {
      const h = heading('DirectionalLight3D', { name: 'Light', parent: '.' });

      const result = parseDirectionalLight3D(h, {
        light_energy: '',
        shadow_bias: '',
        directional_shadow_max_distance: ''
      });

      // Empty strings are falsy, so defaults are used
      expect(result.light_energy).toBe(1.0); // Default
      expect(result.shadow_bias).toBeUndefined(); // Default
      expect(result.directional_shadow_max_distance).toBeUndefined(); // Default
    });

    it('should handle negative values in numeric properties', () => {
      const h = heading('DirectionalLight3D', { name: 'Light', parent: '.' });

      const result = parseDirectionalLight3D(h, {
        light_energy: '-1.5',
        shadow_bias: '-0.1',
        directional_shadow_max_distance: '-100.0'
      });

      // Parsers accept negative values (validation happens elsewhere)
      expect(result.light_energy).toBe(-1.5);
      expect(result.shadow_bias).toBe(-0.1);
      expect(result.directional_shadow_max_distance).toBe(-100.0);
    });

    it('should handle malformed color strings', () => {
      const h = heading('DirectionalLight3D', { name: 'Light', parent: '.' });

      // Parser accepts any string for light_color (validation happens in renderer)
      const result = parseDirectionalLight3D(h, { light_color: 'invalid-color' });
      expect(result.light_color).toBe('invalid-color');
    });

    it('should handle extremely large numeric values', () => {
      const h = heading('DirectionalLight3D', { name: 'Light', parent: '.' });

      const result = parseDirectionalLight3D(h, {
        light_energy: '999999999.999',
        directional_shadow_max_distance: '1e10'
      });

      expect(result.light_energy).toBe(999999999.999);
      expect(result.directional_shadow_max_distance).toBe(1e10);
    });
  });
});
