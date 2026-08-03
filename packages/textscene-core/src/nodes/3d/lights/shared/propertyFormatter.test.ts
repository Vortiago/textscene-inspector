/**
 * Tests for shared light property formatting utilities
 */

import { describe, it, expect } from 'vitest';
import {
  formatBaseLightSection,
  formatBaseShadowSection,
  formatShadowSectionWithNormalBias,
} from './propertyFormatter';

describe('Base Light Property Formatter', () => {
  describe('formatBaseLightSection', () => {
    it('should format basic light properties', () => {
      const properties = {
        light_color: 'Color(1, 0.5, 0, 1)',
        light_energy: 2.5,
        shadow_enabled: false,
      };

      const section = formatBaseLightSection(properties);

      expect(section.title).toBe('Light');
      expect(section.items).toHaveLength(2);
      expect(section.items[0]).toEqual({ label: 'Color', value: 'Color(1, 0.5, 0, 1)' });
      expect(section.items[1]).toEqual({ label: 'Energy', value: '2.50' });
    });

    it('should format light properties with default values', () => {
      const properties = {
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: false,
      };

      const section = formatBaseLightSection(properties);

      expect(section.items[0]).toEqual({ label: 'Color', value: 'Color(1, 1, 1, 1)' });
      expect(section.items[1]).toEqual({ label: 'Energy', value: '1.00' });
    });

    it('should include additional items when provided', () => {
      const properties = {
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: false,
      };

      const additional = [
        { label: 'Range', value: '10.00' },
        { label: 'Angle', value: '45.0°' },
      ];

      const section = formatBaseLightSection(properties, additional);

      expect(section.items).toHaveLength(4);
      expect(section.items[2]).toEqual({ label: 'Range', value: '10.00' });
      expect(section.items[3]).toEqual({ label: 'Angle', value: '45.0°' });
    });

    it('should format fractional energy values correctly', () => {
      const properties = {
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 0.75,
        shadow_enabled: false,
      };

      const section = formatBaseLightSection(properties);

      expect(section.items[1]).toEqual({ label: 'Energy', value: '0.75' });
    });

    it('should format large energy values correctly', () => {
      const properties = {
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 100.5,
        shadow_enabled: false,
      };

      const section = formatBaseLightSection(properties);

      expect(section.items[1]).toEqual({ label: 'Energy', value: '100.50' });
    });

    it('should surface light_negative, light_specular and volumetric fog energy when present', () => {
      const properties = {
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: false,
        light_negative: true,
        light_specular: 0.0,
        light_volumetric_fog_energy: 500.0,
      };

      const section = formatBaseLightSection(properties);
      const byLabel = Object.fromEntries(section.items.map((i) => [i.label, i.value]));

      expect(byLabel['Negative']).toBe('Yes');
      expect(byLabel['Specular']).toBe('0.00');
      expect(byLabel['Volumetric Fog Energy']).toBe('500.00');
    });

    it('should omit the optional light items when absent', () => {
      const properties = {
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: false,
      };

      const section = formatBaseLightSection(properties);
      const labels = section.items.map((i) => i.label);

      expect(labels).not.toContain('Negative');
      expect(labels).not.toContain('Specular');
      expect(labels).not.toContain('Volumetric Fog Energy');
    });
  });

  describe('formatBaseShadowSection', () => {
    it('should format shadow disabled', () => {
      const properties = {
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: false,
      };

      const section = formatBaseShadowSection(properties);

      expect(section.title).toBe('Shadows');
      expect(section.items).toHaveLength(1);
      expect(section.items[0]).toEqual({ label: 'Enabled', value: 'No' });
    });

    it('should format shadow enabled', () => {
      const properties = {
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: true,
      };

      const section = formatBaseShadowSection(properties);

      expect(section.items[0]).toEqual({ label: 'Enabled', value: 'Yes' });
    });

    it('should include shadow_bias when present', () => {
      const properties = {
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: true,
        shadow_bias: 0.05,
      };

      const section = formatBaseShadowSection(properties);

      expect(section.items).toHaveLength(2);
      expect(section.items[1]).toEqual({ label: 'Bias', value: '0.050' });
    });

    it('should include shadow_blur when present', () => {
      const properties = {
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: true,
        shadow_blur: 3.0,
      };

      const section = formatBaseShadowSection(properties);

      expect(section.items).toHaveLength(2);
      expect(section.items[1]).toEqual({ label: 'Blur', value: '3.00' });
    });

    it('should include both bias and blur when present', () => {
      const properties = {
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: true,
        shadow_bias: 0.05,
        shadow_blur: 2.0,
      };

      const section = formatBaseShadowSection(properties);

      expect(section.items).toHaveLength(3);
      expect(section.items[0]).toEqual({ label: 'Enabled', value: 'Yes' });
      expect(section.items[1]).toEqual({ label: 'Bias', value: '0.050' });
      expect(section.items[2]).toEqual({ label: 'Blur', value: '2.00' });
    });

    it('should include additional items after base items', () => {
      const properties = {
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: true,
        shadow_bias: 0.05,
      };

      const additional = [{ label: 'Shadow Mode', value: 'ORTHOGONAL' }];

      const section = formatBaseShadowSection(properties, additional);

      expect(section.items).toHaveLength(3);
      expect(section.items[2]).toEqual({ label: 'Shadow Mode', value: 'ORTHOGONAL' });
    });

    it('should format very small bias values correctly', () => {
      const properties = {
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: true,
        shadow_bias: 0.001,
      };

      const section = formatBaseShadowSection(properties);

      expect(section.items[1]).toEqual({ label: 'Bias', value: '0.001' });
    });

    it('should format negative bias values correctly', () => {
      const properties = {
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: true,
        shadow_bias: -0.05,
      };

      const section = formatBaseShadowSection(properties);

      expect(section.items[1]).toEqual({ label: 'Bias', value: '-0.050' });
    });
  });

  describe('formatShadowSectionWithNormalBias', () => {
    it('should include normal bias when present', () => {
      const properties = {
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: true,
        shadow_normal_bias: 0.02,
      };

      const section = formatShadowSectionWithNormalBias(properties);

      expect(section.title).toBe('Shadows');
      const normalBiasItem = section.items.find(item => item.label === 'Normal Bias');
      expect(normalBiasItem).toBeDefined();
      expect(normalBiasItem?.value).toBe('0.020');
    });

    it('should include all shadow properties with normal bias', () => {
      const properties = {
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: true,
        shadow_bias: 0.05,
        shadow_normal_bias: 0.02,
        shadow_blur: 2.0,
      };

      const section = formatShadowSectionWithNormalBias(properties);

      expect(section.items).toHaveLength(4);
      expect(section.items[0]!.label).toBe('Enabled');
      expect(section.items[1]!.label).toBe('Bias');
      expect(section.items[2]!.label).toBe('Normal Bias');
      expect(section.items[3]!.label).toBe('Blur');
    });

    it('should not include normal bias when undefined', () => {
      const properties = {
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: true,
        shadow_bias: 0.05,
      };

      const section = formatShadowSectionWithNormalBias(properties);

      const normalBiasItem = section.items.find(item => item.label === 'Normal Bias');
      expect(normalBiasItem).toBeUndefined();
    });

    it('should include additional items after normal bias', () => {
      const properties = {
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: true,
        shadow_normal_bias: 0.02,
      };

      const additional = [{ label: 'Shadow Mode', value: 'PARALLEL_4_SPLITS' }];

      const section = formatShadowSectionWithNormalBias(properties, additional);

      const lastItem = section.items[section.items.length - 1];
      expect(lastItem).toEqual({ label: 'Shadow Mode', value: 'PARALLEL_4_SPLITS' });
    });

    it('should format fractional normal bias correctly', () => {
      const properties = {
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: true,
        shadow_normal_bias: 0.003,
      };

      const section = formatShadowSectionWithNormalBias(properties);

      const normalBiasItem = section.items.find(item => item.label === 'Normal Bias');
      expect(normalBiasItem?.value).toBe('0.003');
    });

    it('should format negative normal bias correctly', () => {
      const properties = {
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: true,
        shadow_normal_bias: -0.02,
      };

      const section = formatShadowSectionWithNormalBias(properties);

      const normalBiasItem = section.items.find(item => item.label === 'Normal Bias');
      expect(normalBiasItem?.value).toBe('-0.020');
    });
  });
});
