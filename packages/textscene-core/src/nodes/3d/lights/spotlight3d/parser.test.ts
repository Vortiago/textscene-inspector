/**
 * Tests for SpotLight3D parser
 */

import { describe, it, expect } from 'vitest';
import { parseSpotLight3D } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

describe('SpotLight3D Parser', () => {
  describe('parseSpotLight3D', () => {
    it('should parse basic SpotLight3D with defaults', () => {
      const h = heading('SpotLight3D', { name: 'SpotLight', parent: '.' });

      const result = parseSpotLight3D(h, {});

      expect(result.name).toBe('SpotLight');
      expect(result.parent).toBe('.');
      expect(result.light_color).toBe('Color(1, 1, 1, 1)');
      expect(result.light_energy).toBe(1.0);
      expect(result.spot_range).toBe(5.0);
      expect(result.spot_angle).toBe(45.0);
      expect(result.shadow_enabled).toBe(false);
      expect(result.shadow_bias).toBeUndefined();
      expect(result.shadow_blur).toBeUndefined();
    });

    it('should parse SpotLight3D with all properties', () => {
      const h = heading('SpotLight3D', { name: 'SpotLight', parent: '.' });

      const properties = {
        light_color: 'Color(1, 0.8, 0.6, 1)',
        light_energy: '1.5',
        spot_range: '15.0',
        spot_angle: '60.0',
        shadow_enabled: 'true',
        shadow_bias: '0.05',
        shadow_blur: '2',
      };

      const result = parseSpotLight3D(h, properties);

      expect(result.name).toBe('SpotLight');
      expect(result.light_color).toBe('Color(1, 0.8, 0.6, 1)');
      expect(result.light_energy).toBe(1.5);
      expect(result.spot_range).toBe(15.0);
      expect(result.spot_angle).toBe(60.0);
      expect(result.shadow_enabled).toBe(true);
      expect(result.shadow_bias).toBe(0.05);
      expect(result.shadow_blur).toBe(2);
    });

    it('should parse shadow_enabled as false when not "true"', () => {
      const h = heading('SpotLight3D', { name: 'SpotLight', parent: '.' });

      const result1 = parseSpotLight3D(h, { shadow_enabled: 'false' });
      expect(result1.shadow_enabled).toBe(false);

      const result2 = parseSpotLight3D(h, { shadow_enabled: '0' });
      expect(result2.shadow_enabled).toBe(false);

      const result3 = parseSpotLight3D(h, {});
      expect(result3.shadow_enabled).toBe(false);
    });

    it('should handle fractional values', () => {
      const h = heading('SpotLight3D', { name: 'SpotLight', parent: '.' });

      const properties = {
        light_energy: '0.75',
        spot_range: '12.5',
        spot_angle: '37.5',
        shadow_bias: '0.001',
      };

      const result = parseSpotLight3D(h, properties);

      expect(result.light_energy).toBe(0.75);
      expect(result.spot_range).toBe(12.5);
      expect(result.spot_angle).toBe(37.5);
      expect(result.shadow_bias).toBe(0.001);
    });

    it('should parse transform property from Node3D', () => {
      const h = heading('SpotLight3D', { name: 'SpotLight', parent: '.' });

      const properties = {
        transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 0)',
        light_energy: '2.0',
      };

      const result = parseSpotLight3D(h, properties);

      expect(result.transform).toBeDefined();
      expect(result.transform?.origin.x).toBe(0);
      expect(result.transform?.origin.y).toBe(5);
      expect(result.transform?.origin.z).toBe(0);
      expect(result.light_energy).toBe(2.0);
    });

    it('should parse light with parent hierarchy', () => {
      const h = heading('SpotLight3D', { name: 'SpotLight', parent: 'Room' });

      const result = parseSpotLight3D(h, { light_energy: '1.2' });

      expect(result.name).toBe('SpotLight');
      expect(result.parent).toBe('Room');
      expect(result.light_energy).toBe(1.2);
    });
  });
});
