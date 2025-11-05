/**
 * Tests for OmniLight3D renderer
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createOmniLight3D } from './renderer';
import type { OmniLight3DProperties } from './types';

describe('OmniLight3D Renderer', () => {
  describe('createOmniLight3D', () => {
    it('should create a PointLight', () => {
      const properties: OmniLight3DProperties = {
        name: 'TestLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        omni_range: 10.0,
        omni_attenuation: 2.0,
        shadow_enabled: false,
      };

      const light = createOmniLight3D('TestLight', properties);

      expect(light).toBeInstanceOf(THREE.PointLight);
      expect(light.name).toBe('TestLight');
    });

    it('should configure light properties correctly', () => {
      const properties: OmniLight3DProperties = {
        name: 'Lamp',
        light_color: 'Color(1, 0.8, 0.6, 1)',
        light_energy: 2.0,
        omni_range: 15.0,
        omni_attenuation: 2.0,
        shadow_enabled: false,
      };

      const light = createOmniLight3D('Lamp', properties);

      expect(light.color.getHex()).toBe(0xffcc99); // Warm orange color
      expect(light.intensity).toBe(4.0); // 2.0 * 2 (scaling factor)
      expect(light.distance).toBe(15.0);
      expect(light.decay).toBe(2.0); // Physically accurate quadratic falloff
    });

    it('should configure shadows when enabled', () => {
      const properties: OmniLight3DProperties = {
        name: 'Lamp',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        omni_range: 20.0,
        omni_attenuation: 2.0,
        shadow_enabled: true,
        shadow_bias: 0.05,
        shadow_filter: 2,
      };

      const light = createOmniLight3D('Lamp', properties);

      expect(light.castShadow).toBe(true);

      // Shadow camera (perspective for cubemap)
      expect(light.shadow.camera.near).toBe(0.5);
      expect(light.shadow.camera.far).toBe(20.0);

      // Shadow map size (per face - 6 faces total for cubemap)
      expect(light.shadow.mapSize.width).toBe(1024); // filter=2 -> 1024
      expect(light.shadow.mapSize.height).toBe(1024);

      // Shadow bias
      expect(light.shadow.bias).toBeCloseTo(-0.0005, 6); // -0.05 * 0.01

      expect(light.shadow.radius).toBe(4);
    });

    it('should not enable shadows when shadow_enabled is false', () => {
      const properties: OmniLight3DProperties = {
        name: 'Lamp',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        omni_range: 10.0,
        omni_attenuation: 2.0,
        shadow_enabled: false,
      };

      const light = createOmniLight3D('Lamp', properties);

      expect(light.castShadow).toBe(false);
    });

    it('should use default shadow bias when not specified', () => {
      const properties: OmniLight3DProperties = {
        name: 'Lamp',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        omni_range: 10.0,
        omni_attenuation: 2.0,
        shadow_enabled: true,
      };

      const light = createOmniLight3D('Lamp', properties);

      expect(light.shadow.bias).toBe(-0.001);
    });

    it('should map shadow filter to correct shadow map size', () => {
      const testCases = [
        { filter: 0, expectedSize: 256 },
        { filter: 1, expectedSize: 512 },
        { filter: 2, expectedSize: 1024 },
        { filter: 3, expectedSize: 1024 }, // Capped at 1024 for performance
        { filter: undefined, expectedSize: 512 }, // Default
      ];

      testCases.forEach(({ filter, expectedSize }) => {
        const properties: OmniLight3DProperties = {
          name: 'Lamp',
          light_color: 'Color(1, 1, 1, 1)',
          light_energy: 1.0,
          omni_range: 10.0,
          omni_attenuation: 2.0,
          shadow_enabled: true,
          shadow_filter: filter,
        };

        const light = createOmniLight3D('Lamp', properties);

        expect(light.shadow.mapSize.width).toBe(expectedSize);
        expect(light.shadow.mapSize.height).toBe(expectedSize);
      });
    });

    it('should handle white light color', () => {
      const properties: OmniLight3DProperties = {
        name: 'Lamp',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        omni_range: 10.0,
        omni_attenuation: 2.0,
        shadow_enabled: false,
      };

      const light = createOmniLight3D('Lamp', properties);

      expect(light.color.getHex()).toBe(0xffffff);
    });

    it('should handle colored light', () => {
      const properties: OmniLight3DProperties = {
        name: 'Candle',
        light_color: 'Color(1, 0.7, 0.3, 1)', // Warm candlelight
        light_energy: 0.5,
        omni_range: 5.0,
        omni_attenuation: 2.0,
        shadow_enabled: false,
      };

      const light = createOmniLight3D('Candle', properties);

      expect(light.color.getHex()).toBe(0xffb34d);
    });

    it('should handle different attenuation values', () => {
      const testCases = [
        { attenuation: 1.0, expected: 1.0 }, // Linear falloff
        { attenuation: 2.0, expected: 2.0 }, // Physically accurate quadratic
        { attenuation: 1.5, expected: 1.5 }, // Custom falloff
      ];

      testCases.forEach(({ attenuation, expected }) => {
        const properties: OmniLight3DProperties = {
          name: 'Lamp',
          light_color: 'Color(1, 1, 1, 1)',
          light_energy: 1.0,
          omni_range: 10.0,
          omni_attenuation: attenuation,
          shadow_enabled: false,
        };

        const light = createOmniLight3D('Lamp', properties);

        expect(light.decay).toBe(expected);
      });
    });

    it('should handle small range values', () => {
      const properties: OmniLight3DProperties = {
        name: 'SmallLamp',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        omni_range: 2.0, // Very small range
        omni_attenuation: 2.0,
        shadow_enabled: false,
      };

      const light = createOmniLight3D('SmallLamp', properties);

      expect(light.distance).toBe(2.0);
    });

    it('should handle large range values', () => {
      const properties: OmniLight3DProperties = {
        name: 'LargeLamp',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 5.0,
        omni_range: 50.0, // Large range
        omni_attenuation: 2.0,
        shadow_enabled: false,
      };

      const light = createOmniLight3D('LargeLamp', properties);

      expect(light.distance).toBe(50.0);
      expect(light.intensity).toBe(10.0); // 5.0 * 2
    });

    it('should match shadow camera far to light range', () => {
      const properties: OmniLight3DProperties = {
        name: 'Lamp',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        omni_range: 25.0,
        omni_attenuation: 2.0,
        shadow_enabled: true,
      };

      const light = createOmniLight3D('Lamp', properties);

      expect(light.shadow.camera.far).toBe(25.0);
      expect(light.distance).toBe(25.0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid color format gracefully', () => {
      const properties: OmniLight3DProperties = {
        name: 'BadColorLight',
        light_color: 'InvalidColor',
        light_energy: 1.0,
        omni_range: 10.0,
        omni_attenuation: 2.0,
        shadow_enabled: false,
      };

      const light = createOmniLight3D('BadColorLight', properties);

      // Should fallback to white or handle gracefully
      expect(light).toBeInstanceOf(THREE.PointLight);
      expect(light.color).toBeDefined();
    });

    it('should handle missing light_color', () => {
      const properties: OmniLight3DProperties = {
        name: 'NoColorLight',
        // light_color is missing
        light_energy: 1.0,
        omni_range: 10.0,
        omni_attenuation: 2.0,
        shadow_enabled: false,
      };

      const light = createOmniLight3D('NoColorLight', properties);

      expect(light).toBeInstanceOf(THREE.PointLight);
      expect(light.color).toBeDefined();
    });

    it('should handle zero light energy', () => {
      const properties: OmniLight3DProperties = {
        name: 'ZeroEnergyLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 0,
        omni_range: 10.0,
        omni_attenuation: 2.0,
        shadow_enabled: false,
      };

      const light = createOmniLight3D('ZeroEnergyLight', properties);

      expect(light.intensity).toBe(0);
    });

    it('should handle negative light energy', () => {
      const properties: OmniLight3DProperties = {
        name: 'NegativeEnergyLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: -1.0,
        omni_range: 10.0,
        omni_attenuation: 2.0,
        shadow_enabled: false,
      };

      const light = createOmniLight3D('NegativeEnergyLight', properties);

      // Should handle gracefully (clamp or allow negative)
      expect(light).toBeInstanceOf(THREE.PointLight);
      expect(typeof light.intensity).toBe('number');
    });

    it('should handle zero range', () => {
      const properties: OmniLight3DProperties = {
        name: 'ZeroRangeLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        omni_range: 0,
        omni_attenuation: 2.0,
        shadow_enabled: false,
      };

      const light = createOmniLight3D('ZeroRangeLight', properties);

      expect(light.distance).toBe(0);
    });

    it('should handle negative range', () => {
      const properties: OmniLight3DProperties = {
        name: 'NegativeRangeLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        omni_range: -10.0,
        omni_attenuation: 2.0,
        shadow_enabled: false,
      };

      const light = createOmniLight3D('NegativeRangeLight', properties);

      // Should handle gracefully
      expect(light).toBeInstanceOf(THREE.PointLight);
      expect(typeof light.distance).toBe('number');
    });

    it('should handle missing omni_range', () => {
      const properties: OmniLight3DProperties = {
        name: 'NoRangeLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        // omni_range is missing
        omni_attenuation: 2.0,
        shadow_enabled: false,
      };

      const light = createOmniLight3D('NoRangeLight', properties);

      expect(light).toBeInstanceOf(THREE.PointLight);
      expect(typeof light.distance).toBe('number');
    });

    it('should handle zero attenuation', () => {
      const properties: OmniLight3DProperties = {
        name: 'ZeroAttenuationLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        omni_range: 10.0,
        omni_attenuation: 0,
        shadow_enabled: false,
      };

      const light = createOmniLight3D('ZeroAttenuationLight', properties);

      expect(light.decay).toBe(0);
    });

    it('should handle negative attenuation', () => {
      const properties: OmniLight3DProperties = {
        name: 'NegativeAttenuationLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        omni_range: 10.0,
        omni_attenuation: -1.0,
        shadow_enabled: false,
      };

      const light = createOmniLight3D('NegativeAttenuationLight', properties);

      // Should handle gracefully
      expect(light).toBeInstanceOf(THREE.PointLight);
      expect(typeof light.decay).toBe('number');
    });

    it('should handle extreme shadow bias values', () => {
      const properties: OmniLight3DProperties = {
        name: 'ExtremeBiasLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        omni_range: 10.0,
        omni_attenuation: 2.0,
        shadow_enabled: true,
        shadow_bias: 1000.0,
      };

      const light = createOmniLight3D('ExtremeBiasLight', properties);

      expect(light.castShadow).toBe(true);
      expect(typeof light.shadow.bias).toBe('number');
    });

    it('should handle negative shadow bias', () => {
      const properties: OmniLight3DProperties = {
        name: 'NegativeBiasLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        omni_range: 10.0,
        omni_attenuation: 2.0,
        shadow_enabled: true,
        shadow_bias: -100.0,
      };

      const light = createOmniLight3D('NegativeBiasLight', properties);

      expect(light.castShadow).toBe(true);
      expect(typeof light.shadow.bias).toBe('number');
    });

    it('should handle invalid shadow filter (too high)', () => {
      const properties: OmniLight3DProperties = {
        name: 'InvalidFilterLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        omni_range: 10.0,
        omni_attenuation: 2.0,
        shadow_enabled: true,
        shadow_filter: 999,
      };

      const light = createOmniLight3D('InvalidFilterLight', properties);

      expect(light.castShadow).toBe(true);
      // Should clamp or handle gracefully
      expect(light.shadow.mapSize.width).toBeGreaterThan(0);
    });

    it('should handle negative shadow filter', () => {
      const properties: OmniLight3DProperties = {
        name: 'NegativeFilterLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        omni_range: 10.0,
        omni_attenuation: 2.0,
        shadow_enabled: true,
        shadow_filter: -5,
      };

      const light = createOmniLight3D('NegativeFilterLight', properties);

      expect(light.castShadow).toBe(true);
      // Should handle gracefully
      expect(light.shadow.mapSize.width).toBeGreaterThan(0);
    });

    it('should handle color values outside 0-1 range', () => {
      const properties: OmniLight3DProperties = {
        name: 'ExtremeColorLight',
        light_color: 'Color(2.5, -0.5, 1.5, 1)',
        light_energy: 1.0,
        omni_range: 10.0,
        omni_attenuation: 2.0,
        shadow_enabled: false,
      };

      const light = createOmniLight3D('ExtremeColorLight', properties);

      expect(light).toBeInstanceOf(THREE.PointLight);
      expect(light.color).toBeDefined();
    });
  });
});
