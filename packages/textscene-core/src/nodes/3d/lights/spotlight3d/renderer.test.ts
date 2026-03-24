/**
 * Tests for SpotLight3D renderer
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createSpotLight3D } from './renderer';
import { positionLightTarget } from '../../../../utils/lightTargetUtils';
import type { SpotLight3DProperties } from './types';

describe('SpotLight3D Renderer', () => {
  describe('createSpotLight3D', () => {
    it('should create a Group with SpotLight and target', () => {
      const properties: SpotLight3DProperties = {
        name: 'TestLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        spot_range: 10.0,
        spot_angle: 45.0,
        shadow_enabled: false,
      };

      const group = createSpotLight3D('TestLight', properties);

      expect(group).toBeInstanceOf(THREE.Group);
      expect(group.name).toBe('TestLight');
      expect(group.children).toHaveLength(2);

      const light = group.children.find((child) => child instanceof THREE.SpotLight);
      const target = group.children.find((child) => child.name.endsWith('_target'));

      expect(light).toBeDefined();
      expect(target).toBeDefined();
    });

    it('should configure light properties correctly', () => {
      const properties: SpotLight3DProperties = {
        name: 'TestLight',
        light_color: 'Color(1, 0.5, 0, 1)',
        light_energy: 2.0,
        spot_range: 15.0,
        spot_angle: 60.0,
        shadow_enabled: false,
      };

      const group = createSpotLight3D('TestLight', properties);
      const light = group.children.find((child) => child instanceof THREE.SpotLight) as THREE.SpotLight;

      expect(light.color.getHex()).toBe(0xff8000); // Orange
      expect(light.intensity).toBe(4.0); // 2.0 * 2 (scaling factor)
      expect(light.distance).toBe(15.0);
      expect(light.angle).toBeCloseTo((60.0 * Math.PI) / 180, 5); // Convert to radians
      expect(light.decay).toBe(2); // Physically accurate
    });

    it('should link light to target', () => {
      const properties: SpotLight3DProperties = {
        name: 'TestLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        spot_range: 10.0,
        spot_angle: 45.0,
        shadow_enabled: false,
      };

      const group = createSpotLight3D('TestLight', properties);
      const light = group.children.find((child) => child instanceof THREE.SpotLight) as THREE.SpotLight;
      const target = group.children.find((child) => child.name.endsWith('_target'));

      expect(light.target).toBe(target);
    });

    it('should configure shadows when enabled', () => {
      const properties: SpotLight3DProperties = {
        name: 'TestLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        spot_range: 20.0,
        spot_angle: 45.0,
        shadow_enabled: true,
        shadow_bias: 0.05,
        shadow_filter: 2,
      };

      const group = createSpotLight3D('TestLight', properties);
      const light = group.children.find((child) => child instanceof THREE.SpotLight) as THREE.SpotLight;

      expect(light.castShadow).toBe(true);
      expect(light.shadow.camera.near).toBe(0.5);
      expect(light.shadow.camera.far).toBe(20.0);
      expect(light.shadow.mapSize.width).toBe(1024); // filter=2 -> 1024
      expect(light.shadow.mapSize.height).toBe(1024);
      expect(light.shadow.bias).toBeCloseTo(-0.0005, 6); // -0.05 * 0.01
      expect(light.shadow.radius).toBe(4);
    });

    it('should not enable shadows when shadow_enabled is false', () => {
      const properties: SpotLight3DProperties = {
        name: 'TestLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        spot_range: 10.0,
        spot_angle: 45.0,
        shadow_enabled: false,
      };

      const group = createSpotLight3D('TestLight', properties);
      const light = group.children.find((child) => child instanceof THREE.SpotLight) as THREE.SpotLight;

      expect(light.castShadow).toBe(false);
    });

    it('should use default shadow bias when not specified', () => {
      const properties: SpotLight3DProperties = {
        name: 'TestLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        spot_range: 10.0,
        spot_angle: 45.0,
        shadow_enabled: true,
      };

      const group = createSpotLight3D('TestLight', properties);
      const light = group.children.find((child) => child instanceof THREE.SpotLight) as THREE.SpotLight;

      expect(light.shadow.bias).toBe(-0.002);
    });

    it('should map shadow filter to correct shadow map size', () => {
      const testCases = [
        { filter: 0, expectedSize: 256 },
        { filter: 1, expectedSize: 512 },
        { filter: 2, expectedSize: 1024 },
        { filter: 3, expectedSize: 2048 },
        { filter: undefined, expectedSize: 512 }, // Default
      ];

      testCases.forEach(({ filter, expectedSize }) => {
        const properties: SpotLight3DProperties = {
          name: 'TestLight',
          light_color: 'Color(1, 1, 1, 1)',
          light_energy: 1.0,
          spot_range: 10.0,
          spot_angle: 45.0,
          shadow_enabled: true,
          shadow_filter: filter,
        };

        const group = createSpotLight3D('TestLight', properties);
        const light = group.children.find((child) => child instanceof THREE.SpotLight) as THREE.SpotLight;

        expect(light.shadow.mapSize.width).toBe(expectedSize);
        expect(light.shadow.mapSize.height).toBe(expectedSize);
      });
    });

    it('should use default penumbra when not specified', () => {
      const properties: SpotLight3DProperties = {
        name: 'TestLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        spot_range: 10.0,
        spot_angle: 45.0,
        shadow_enabled: false,
      };

      const group = createSpotLight3D('TestLight', properties);
      const light = group.children.find((child) => child instanceof THREE.SpotLight) as THREE.SpotLight;

      expect(light.penumbra).toBe(0.1);
    });

    it('should handle white light color', () => {
      const properties: SpotLight3DProperties = {
        name: 'TestLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        spot_range: 10.0,
        spot_angle: 45.0,
        shadow_enabled: false,
      };

      const group = createSpotLight3D('TestLight', properties);
      const light = group.children.find((child) => child instanceof THREE.SpotLight) as THREE.SpotLight;

      expect(light.color.getHex()).toBe(0xffffff);
    });

    it('should handle colored light', () => {
      const properties: SpotLight3DProperties = {
        name: 'TestLight',
        light_color: 'Color(0.8, 0.8, 1, 1)', // Blueish
        light_energy: 1.0,
        spot_range: 10.0,
        spot_angle: 45.0,
        shadow_enabled: false,
      };

      const group = createSpotLight3D('TestLight', properties);
      const light = group.children.find((child) => child instanceof THREE.SpotLight) as THREE.SpotLight;

      expect(light.color.getHex()).toBe(0xccccff);
    });
  });

  describe('positionLightTarget', () => {
    it('should position target based on quaternion', () => {
      const properties: SpotLight3DProperties = {
        name: 'TestLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        spot_range: 10.0,
        spot_angle: 45.0,
        shadow_enabled: false,
      };

      const group = createSpotLight3D('TestLight', properties);

      // Identity rotation (no rotation)
      const quaternion = new THREE.Quaternion();
      positionLightTarget(group, quaternion, 10);

      const target = group.children.find((child) => child.name.endsWith('_target'));
      expect(target).toBeDefined();

      // Forward is -Z in Godot
      expect(target!.position.x).toBeCloseTo(0, 5);
      expect(target!.position.y).toBeCloseTo(0, 5);
      expect(target!.position.z).toBeCloseTo(-10, 5);
    });

    it('should handle 90 degree Y rotation', () => {
      const properties: SpotLight3DProperties = {
        name: 'TestLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        spot_range: 10.0,
        spot_angle: 45.0,
        shadow_enabled: false,
      };

      const group = createSpotLight3D('TestLight', properties);

      // 90 degrees around Y axis
      const quaternion = new THREE.Quaternion();
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
      positionLightTarget(group, quaternion, 10);

      const target = group.children.find((child) => child.name.endsWith('_target'));
      expect(target).toBeDefined();

      // Should point in -X direction after Y rotation
      expect(target!.position.x).toBeCloseTo(-10, 5);
      expect(target!.position.y).toBeCloseTo(0, 5);
      expect(target!.position.z).toBeCloseTo(0, 5);
    });

    it('should use custom distance', () => {
      const properties: SpotLight3DProperties = {
        name: 'TestLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        spot_range: 10.0,
        spot_angle: 45.0,
        shadow_enabled: false,
      };

      const group = createSpotLight3D('TestLight', properties);
      const quaternion = new THREE.Quaternion();
      positionLightTarget(group, quaternion, 20);

      const target = group.children.find((child) => child.name.endsWith('_target'));
      expect(target).toBeDefined();

      expect(target!.position.z).toBeCloseTo(-20, 5);
    });
  });
});
