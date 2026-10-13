/** AreaLight3D parser. */

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
      // 4.7.2: light_3d.cpp:493,495 set range 5 and attenuation 1, and :749 the 1×1 size.
      expect(result.area_range).toBe(5.0);
      expect(result.area_attenuation).toBe(1.0);
      expect(result.area_size).toEqual({ x: 1, y: 1 });
      expect(result.area_texture).toBeUndefined();
      expect(result.shadow_enabled).toBe(false);
    });

    it('defaults light_specular to the AreaLight3D 1.0, not the Light3D 0.5', () => {
      // 4.7.2: light_3d.cpp:748 overrides the Light3D default of :492.
      const result = parseAreaLight3D(heading('AreaLight3D', { name: 'Area', parent: '.' }), {});

      expect(result.light_specular).toBe(1.0);
    });

    it('parses area_attenuation and area_texture', () => {
      const result = parseAreaLight3D(heading('AreaLight3D', { name: 'Area', parent: '.' }), {
        area_attenuation: '2.0',
        area_texture: 'ExtResource("1_panel")',
      });

      expect(result.area_attenuation).toBe(2.0);
      expect(result.area_texture).toBe('ExtResource("1_panel")');
    });

    it('falls back to attenuation 1 for an unparseable area_attenuation (error case)', () => {
      const result = parseAreaLight3D(heading('AreaLight3D', { name: 'Area', parent: '.' }), {
        area_attenuation: 'steep',
      });

      expect(result.area_attenuation).toBe(1.0);
    });

    it('clamps a negative area_size axis to 0, as the setter does (edge case)', () => {
      // 4.7.2: light_3d.cpp:724 stores `p_size.maxf(0.0f)`.
      const result = parseAreaLight3D(heading('AreaLight3D', { name: 'Area', parent: '.' }), {
        area_size: 'Vector2(-2, 3)',
      });

      expect(result.area_size).toEqual({ x: 0, y: 3 });
    });

    it('parses the distance fade, which 4.7.2 applies to an area light', () => {
      // 4.7.2: light_storage.cpp:1012-1029 fades every positional light, area included.
      const result = parseAreaLight3D(heading('AreaLight3D', { name: 'Area', parent: '.' }), {
        distance_fade_enabled: 'true',
        distance_fade_begin: '12',
        distance_fade_length: '3',
      });

      expect(result.distance_fade_enabled).toBe(true);
      expect(result.distance_fade_begin).toBe(12);
      expect(result.distance_fade_length).toBe(3);
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

      // The shared parseVector2 rejects junk such as "Vector2(4abc, 3)", which
      // falls back to the 1×1 default, so render and lint agree.
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
