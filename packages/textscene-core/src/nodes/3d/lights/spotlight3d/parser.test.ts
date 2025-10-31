/**
 * Tests for SpotLight3D parser
 */

import { describe, it, expect } from 'vitest';
import { parseSpotLight3D, isSpotLight3D } from './parser';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseHeading } from '../../../../parser/utils';

describe('SpotLight3D Parser', () => {
  describe('isSpotLight3D', () => {
    it('should identify SpotLight3D nodes', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'MySpotLight',
          type: 'SpotLight3D',
        },
      };

      expect(isSpotLight3D(heading)).toBe(true);
    });

    it('should reject Node3D nodes', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'MyNode',
          type: 'Node3D',
        },
      };

      expect(isSpotLight3D(heading)).toBe(false);
    });

    it('should reject DirectionalLight3D nodes', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'MyLight',
          type: 'DirectionalLight3D',
        },
      };

      expect(isSpotLight3D(heading)).toBe(false);
    });

    it('should reject non-node headings', () => {
      const heading: ParsedHeading = {
        type: 'ext_resource',
        attributes: {},
      };

      expect(isSpotLight3D(heading)).toBe(false);
    });
  });

  describe('parseSpotLight3D', () => {
    it('should parse basic SpotLight3D with defaults', () => {
      const heading = parseHeading('[node name="SpotLight" type="SpotLight3D" parent="."]');
      expect(heading).not.toBeNull();

      const result = parseSpotLight3D(heading!, {});

      expect(result.name).toBe('SpotLight');
      expect(result.parent).toBe('.');
      expect(result.light_color).toBe('Color(1, 1, 1, 1)');
      expect(result.light_energy).toBe(1.0);
      expect(result.spot_range).toBe(5.0);
      expect(result.spot_angle).toBe(45.0);
      expect(result.shadow_enabled).toBe(false);
      expect(result.shadow_bias).toBeUndefined();
      expect(result.shadow_filter).toBeUndefined();
    });

    it('should parse SpotLight3D with all properties', () => {
      const heading = parseHeading('[node name="SpotLight" type="SpotLight3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        light_color: 'Color(1, 0.8, 0.6, 1)',
        light_energy: '1.5',
        spot_range: '15.0',
        spot_angle: '60.0',
        shadow_enabled: 'true',
        shadow_bias: '0.05',
        shadow_filter: '2',
      };

      const result = parseSpotLight3D(heading!, properties);

      expect(result.name).toBe('SpotLight');
      expect(result.light_color).toBe('Color(1, 0.8, 0.6, 1)');
      expect(result.light_energy).toBe(1.5);
      expect(result.spot_range).toBe(15.0);
      expect(result.spot_angle).toBe(60.0);
      expect(result.shadow_enabled).toBe(true);
      expect(result.shadow_bias).toBe(0.05);
      expect(result.shadow_filter).toBe(2);
    });

    it('should parse shadow_enabled as false when not "true"', () => {
      const heading = parseHeading('[node name="SpotLight" type="SpotLight3D" parent="."]');
      expect(heading).not.toBeNull();

      const result1 = parseSpotLight3D(heading!, { shadow_enabled: 'false' });
      expect(result1.shadow_enabled).toBe(false);

      const result2 = parseSpotLight3D(heading!, { shadow_enabled: '0' });
      expect(result2.shadow_enabled).toBe(false);

      const result3 = parseSpotLight3D(heading!, {});
      expect(result3.shadow_enabled).toBe(false);
    });

    it('should handle fractional values', () => {
      const heading = parseHeading('[node name="SpotLight" type="SpotLight3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        light_energy: '0.75',
        spot_range: '12.5',
        spot_angle: '37.5',
        shadow_bias: '0.001',
      };

      const result = parseSpotLight3D(heading!, properties);

      expect(result.light_energy).toBe(0.75);
      expect(result.spot_range).toBe(12.5);
      expect(result.spot_angle).toBe(37.5);
      expect(result.shadow_bias).toBe(0.001);
    });

    it('should parse transform property from Node3D', () => {
      const heading = parseHeading('[node name="SpotLight" type="SpotLight3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 0)',
        light_energy: '2.0',
      };

      const result = parseSpotLight3D(heading!, properties);

      expect(result.transform).toBeDefined();
      expect(result.transform?.origin.x).toBe(0);
      expect(result.transform?.origin.y).toBe(5);
      expect(result.transform?.origin.z).toBe(0);
      expect(result.light_energy).toBe(2.0);
    });

    it('should parse light with parent hierarchy', () => {
      const heading = parseHeading('[node name="SpotLight" type="SpotLight3D" parent="Room"]');
      expect(heading).not.toBeNull();

      const result = parseSpotLight3D(heading!, { light_energy: '1.2' });

      expect(result.name).toBe('SpotLight');
      expect(result.parent).toBe('Room');
      expect(result.light_energy).toBe(1.2);
    });
  });
});
