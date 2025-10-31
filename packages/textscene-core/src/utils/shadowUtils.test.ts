/**
 * Tests for shadow utilities
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getShadowMapSize, configureLightShadow } from './shadowUtils';
import { DEFAULT_SHADOW_BIAS } from './lightConstants';

describe('shadowUtils', () => {
  describe('getShadowMapSize', () => {
    it('should return 256 for filter level 0', () => {
      expect(getShadowMapSize(0)).toBe(256);
    });

    it('should return 512 for filter level 1', () => {
      expect(getShadowMapSize(1)).toBe(512);
    });

    it('should return 1024 for filter level 2', () => {
      expect(getShadowMapSize(2)).toBe(1024);
    });

    it('should return 2048 for filter level 3', () => {
      expect(getShadowMapSize(3)).toBe(2048);
    });

    it('should return 512 as default when filter is undefined', () => {
      expect(getShadowMapSize()).toBe(512);
    });

    it('should return 512 as default for unknown filter values', () => {
      expect(getShadowMapSize(99)).toBe(512);
    });

    it('should cap at maxSize when provided', () => {
      expect(getShadowMapSize(3, 1024)).toBe(1024); // 2048 capped to 1024
      expect(getShadowMapSize(2, 1024)).toBe(1024); // 1024 stays 1024
      expect(getShadowMapSize(1, 1024)).toBe(512); // 512 under cap
    });

    it('should not cap when size is under maxSize', () => {
      expect(getShadowMapSize(0, 1024)).toBe(256);
      expect(getShadowMapSize(1, 2048)).toBe(512);
    });
  });

  describe('configureLightShadow', () => {
    it('should enable shadow casting', () => {
      const light = new THREE.SpotLight();
      configureLightShadow(light, undefined, undefined, DEFAULT_SHADOW_BIAS.SPOT);

      expect(light.castShadow).toBe(true);
    });

    it('should set shadow map size based on filter', () => {
      const light = new THREE.SpotLight();
      configureLightShadow(light, undefined, 2, DEFAULT_SHADOW_BIAS.SPOT);

      expect(light.shadow.mapSize.width).toBe(1024);
      expect(light.shadow.mapSize.height).toBe(1024);
    });

    it('should use custom shadow bias when provided', () => {
      const light = new THREE.SpotLight();
      configureLightShadow(light, 0.05, undefined, DEFAULT_SHADOW_BIAS.SPOT);

      // 0.05 * 0.01 = 0.0005, negated = -0.0005
      expect(light.shadow.bias).toBeCloseTo(-0.0005, 6);
    });

    it('should use default bias when shadowBias not provided', () => {
      const light = new THREE.SpotLight();
      configureLightShadow(light, undefined, undefined, DEFAULT_SHADOW_BIAS.DIRECTIONAL);

      expect(light.shadow.bias).toBe(DEFAULT_SHADOW_BIAS.DIRECTIONAL);
    });

    it('should set shadow radius to default', () => {
      const light = new THREE.SpotLight();
      configureLightShadow(light, undefined, undefined, DEFAULT_SHADOW_BIAS.SPOT);

      expect(light.shadow.radius).toBe(4);
    });

    it('should cap shadow map size when maxMapSize provided', () => {
      const light = new THREE.PointLight();
      configureLightShadow(light, undefined, 3, DEFAULT_SHADOW_BIAS.OMNI, 1024);

      // Filter 3 normally gives 2048, but capped at 1024
      expect(light.shadow.mapSize.width).toBe(1024);
      expect(light.shadow.mapSize.height).toBe(1024);
    });

    it('should work with DirectionalLight', () => {
      const light = new THREE.DirectionalLight();
      configureLightShadow(light, 0.02, 1, DEFAULT_SHADOW_BIAS.DIRECTIONAL);

      expect(light.castShadow).toBe(true);
      expect(light.shadow.mapSize.width).toBe(512);
      expect(light.shadow.bias).toBeCloseTo(-0.0002, 6);
    });

    it('should work with PointLight', () => {
      const light = new THREE.PointLight();
      configureLightShadow(light, undefined, 2, DEFAULT_SHADOW_BIAS.OMNI);

      expect(light.castShadow).toBe(true);
      expect(light.shadow.mapSize.width).toBe(1024);
      expect(light.shadow.bias).toBe(DEFAULT_SHADOW_BIAS.OMNI);
    });
  });
});
