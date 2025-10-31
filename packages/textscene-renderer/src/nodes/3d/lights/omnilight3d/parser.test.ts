/**
 * Tests for OmniLight3D parser
 */

import { describe, it, expect } from 'vitest';
import { parseOmniLight3D, isOmniLight3D } from './parser';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseHeading } from '../../../../parser/utils';

describe('OmniLight3D Parser', () => {
  describe('isOmniLight3D', () => {
    it('should identify OmniLight3D nodes', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'MyOmniLight',
          type: 'OmniLight3D',
        },
      };

      expect(isOmniLight3D(heading)).toBe(true);
    });

    it('should reject Node3D nodes', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'MyNode',
          type: 'Node3D',
        },
      };

      expect(isOmniLight3D(heading)).toBe(false);
    });

    it('should reject SpotLight3D nodes', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'MyLight',
          type: 'SpotLight3D',
        },
      };

      expect(isOmniLight3D(heading)).toBe(false);
    });

    it('should reject non-node headings', () => {
      const heading: ParsedHeading = {
        type: 'ext_resource',
        attributes: {},
      };

      expect(isOmniLight3D(heading)).toBe(false);
    });
  });

  describe('parseOmniLight3D', () => {
    it('should parse basic OmniLight3D with defaults', () => {
      const heading = parseHeading('[node name="OmniLight" type="OmniLight3D" parent="."]');
      expect(heading).not.toBeNull();

      const result = parseOmniLight3D(heading!, {});

      expect(result.name).toBe('OmniLight');
      expect(result.parent).toBe('.');
      expect(result.light_color).toBe('Color(1, 1, 1, 1)');
      expect(result.light_energy).toBe(1.0);
      expect(result.omni_range).toBe(5.0);
      expect(result.omni_attenuation).toBe(1.0);
      expect(result.shadow_enabled).toBe(false);
      expect(result.shadow_bias).toBeUndefined();
      expect(result.shadow_normal_bias).toBeUndefined();
      expect(result.shadow_filter).toBeUndefined();
      expect(result.omni_shadow_mode).toBeUndefined();
    });

    it('should parse OmniLight3D with all properties', () => {
      const heading = parseHeading('[node name="Lamp" type="OmniLight3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        light_color: 'Color(1, 0.8, 0.6, 1)',
        light_energy: '2.0',
        omni_range: '10.0',
        omni_attenuation: '2.0',
        shadow_enabled: 'true',
        shadow_bias: '0.05',
        shadow_normal_bias: '0.02',
        shadow_filter: '2',
        omni_shadow_mode: '1',
      };

      const result = parseOmniLight3D(heading!, properties);

      expect(result.name).toBe('Lamp');
      expect(result.light_color).toBe('Color(1, 0.8, 0.6, 1)');
      expect(result.light_energy).toBe(2.0);
      expect(result.omni_range).toBe(10.0);
      expect(result.omni_attenuation).toBe(2.0);
      expect(result.shadow_enabled).toBe(true);
      expect(result.shadow_bias).toBe(0.05);
      expect(result.shadow_normal_bias).toBe(0.02);
      expect(result.shadow_filter).toBe(2);
      expect(result.omni_shadow_mode).toBe(1);
    });

    it('should parse shadow_enabled as false when not "true"', () => {
      const heading = parseHeading('[node name="Lamp" type="OmniLight3D" parent="."]');
      expect(heading).not.toBeNull();

      const result1 = parseOmniLight3D(heading!, { shadow_enabled: 'false' });
      expect(result1.shadow_enabled).toBe(false);

      const result2 = parseOmniLight3D(heading!, { shadow_enabled: '0' });
      expect(result2.shadow_enabled).toBe(false);

      const result3 = parseOmniLight3D(heading!, {});
      expect(result3.shadow_enabled).toBe(false);
    });

    it('should handle fractional values', () => {
      const heading = parseHeading('[node name="Lamp" type="OmniLight3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        light_energy: '0.75',
        omni_range: '7.5',
        omni_attenuation: '1.5',
        shadow_bias: '0.001',
        shadow_normal_bias: '0.005',
      };

      const result = parseOmniLight3D(heading!, properties);

      expect(result.light_energy).toBe(0.75);
      expect(result.omni_range).toBe(7.5);
      expect(result.omni_attenuation).toBe(1.5);
      expect(result.shadow_bias).toBe(0.001);
      expect(result.shadow_normal_bias).toBe(0.005);
    });

    it('should parse transform property from Node3D', () => {
      const heading = parseHeading('[node name="Lamp" type="OmniLight3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 2, 0)',
        light_energy: '1.5',
      };

      const result = parseOmniLight3D(heading!, properties);

      expect(result.transform).toBeDefined();
      expect(result.transform?.origin.x).toBe(3);
      expect(result.transform?.origin.y).toBe(2);
      expect(result.transform?.origin.z).toBe(0);
      expect(result.light_energy).toBe(1.5);
    });

    it('should parse light with parent hierarchy', () => {
      const heading = parseHeading('[node name="Lamp" type="OmniLight3D" parent="Room"]');
      expect(heading).not.toBeNull();

      const result = parseOmniLight3D(heading!, { light_energy: '2.5' });

      expect(result.name).toBe('Lamp');
      expect(result.parent).toBe('Room');
      expect(result.light_energy).toBe(2.5);
    });

    it('should parse omni_shadow_mode values', () => {
      const heading = parseHeading('[node name="Lamp" type="OmniLight3D" parent="."]');
      expect(heading).not.toBeNull();

      const modes = [
        { value: '0', expected: 0 }, // SHADOW_DUAL_PARABOLOID
        { value: '1', expected: 1 }, // SHADOW_CUBE
      ];

      modes.forEach(({ value, expected }) => {
        const result = parseOmniLight3D(heading!, { omni_shadow_mode: value });
        expect(result.omni_shadow_mode).toBe(expected);
      });
    });

    it('should handle physically accurate attenuation (2.0)', () => {
      const heading = parseHeading('[node name="Lamp" type="OmniLight3D" parent="."]');
      expect(heading).not.toBeNull();

      const result = parseOmniLight3D(heading!, { omni_attenuation: '2.0' });

      expect(result.omni_attenuation).toBe(2.0); // Physically accurate quadratic falloff
    });
  });
});
