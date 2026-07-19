/**
 * Tests for AreaLight3D parser
 */

import { describe, it, expect } from 'vitest';
import { parseAreaLight3D } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

describe('AreaLight3D Parser', () => {
  describe('parseAreaLight3D', () => {
    it('should parse basic AreaLight3D with defaults', () => {
      const h = heading('AreaLight3D', { name: 'Area', parent: '.' });

      const result = parseAreaLight3D(h, {});

      expect(result.name).toBe('Area');
      expect(result.parent).toBe('.');
      expect(result.light_color).toBe('Color(1, 1, 1, 1)');
      expect(result.light_energy).toBe(1.0);
      // class_arealight3d.html properties table: area_range defaults to 5.0.
      expect(result.area_range).toBe(5.0);
      expect(result.area_size).toEqual({ x: 1, y: 1 });
      expect(result.shadow_enabled).toBe(false);
    });

    it('should parse AreaLight3D with all properties', () => {
      const h = heading('AreaLight3D', { name: 'RectLight', parent: '.' });

      const properties = {
        light_color: 'Color(0.5, 0.6, 0.7, 1)',
        light_energy: '4.0',
        area_range: '2.0',
        area_size: 'Vector2(2, 1)',
        shadow_enabled: 'true',
        shadow_bias: '0.05',
        shadow_normal_bias: '0.02',
      };

      const result = parseAreaLight3D(h, properties);

      expect(result.name).toBe('RectLight');
      expect(result.light_color).toBe('Color(0.5, 0.6, 0.7, 1)');
      expect(result.light_energy).toBe(4.0);
      expect(result.area_range).toBe(2.0);
      expect(result.area_size).toEqual({ x: 2, y: 1 });
      expect(result.shadow_enabled).toBe(true);
      expect(result.shadow_bias).toBe(0.05);
      expect(result.shadow_normal_bias).toBe(0.02);
    });

    it('should reject malformed area_size and fall back to 1×1', () => {
      const h = heading('AreaLight3D', { name: 'Area', parent: '.' });

      // Junk the loose hand-rolled regex used to silently coerce (e.g.
      // "Vector2(4abc, 3)" -> [4, 3]) is now rejected by the strict shared
      // parseVector2 and falls back to the 1×1 default — render/lint agree.
      for (const bad of ['Vector2(4abc, 3)', 'Vector2(4 5, 3)', 'not a vector']) {
        const result = parseAreaLight3D(h, { area_size: bad });
        expect(result.area_size).toEqual({ x: 1, y: 1 });
      }
    });

    it('should parse shadow_enabled as false when not "true"', () => {
      const h = heading('AreaLight3D', { name: 'Area', parent: '.' });

      const result1 = parseAreaLight3D(h, { shadow_enabled: 'false' });
      expect(result1.shadow_enabled).toBe(false);

      const result2 = parseAreaLight3D(h, { shadow_enabled: '0' });
      expect(result2.shadow_enabled).toBe(false);

      const result3 = parseAreaLight3D(h, {});
      expect(result3.shadow_enabled).toBe(false);
    });

    it('should handle fractional area_range values', () => {
      const h = heading('AreaLight3D', { name: 'Area', parent: '.' });

      const result = parseAreaLight3D(h, { area_range: '0.5' });
      expect(result.area_range).toBe(0.5);
    });

    it('should parse transform property from Node3D', () => {
      const h = heading('AreaLight3D', { name: 'Area', parent: '.' });

      const properties = {
        transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 2, 0)',
        light_energy: '1.5',
      };

      const result = parseAreaLight3D(h, properties);

      expect(result.transform).toBeDefined();
      expect(result.transform?.origin.x).toBe(3);
      expect(result.transform?.origin.y).toBe(2);
      expect(result.transform?.origin.z).toBe(0);
      expect(result.light_energy).toBe(1.5);
    });

    it('should parse AreaLight3D with parent hierarchy', () => {
      const h = heading('AreaLight3D', { name: 'Area', parent: 'Room' });

      const result = parseAreaLight3D(h, { light_energy: '3.0' });

      expect(result.name).toBe('Area');
      expect(result.parent).toBe('Room');
      expect(result.light_energy).toBe(3.0);
    });
  });
});
