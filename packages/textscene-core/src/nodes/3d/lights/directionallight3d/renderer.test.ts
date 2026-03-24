/**
 * Tests for DirectionalLight3D renderer
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createDirectionalLight3D } from './renderer';
import { positionLightTarget } from '../../../../utils/lightTargetUtils';
import type { DirectionalLight3DProperties } from './types';

describe('DirectionalLight3D Renderer', () => {
  describe('createDirectionalLight3D', () => {
    it('should create a Group with DirectionalLight and target', () => {
      const properties: DirectionalLight3DProperties = {
        name: 'TestLight',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: false,
      };

      const group = createDirectionalLight3D('TestLight', properties);

      expect(group).toBeInstanceOf(THREE.Group);
      expect(group.name).toBe('TestLight');
      expect(group.children).toHaveLength(2);

      const light = group.children.find((child) => child instanceof THREE.DirectionalLight);
      const target = group.children.find((child) => child.name.endsWith('_target'));

      expect(light).toBeDefined();
      expect(target).toBeDefined();
    });

    it('should configure light properties correctly', () => {
      const properties: DirectionalLight3DProperties = {
        name: 'Sun',
        light_color: 'Color(1, 0.95, 0.8, 1)',
        light_energy: 1.5,
        shadow_enabled: false,
      };

      const group = createDirectionalLight3D('Sun', properties);
      const light = group.children.find(
        (child) => child instanceof THREE.DirectionalLight
      ) as THREE.DirectionalLight;

      expect(light.color.getHex()).toBe(0xfff2cc); // Warm sunlight color
      expect(light.intensity).toBe(3.0); // 1.5 * 2 (scaling factor)
    });

    it('should link light to target', () => {
      const properties: DirectionalLight3DProperties = {
        name: 'Sun',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: false,
      };

      const group = createDirectionalLight3D('Sun', properties);
      const light = group.children.find(
        (child) => child instanceof THREE.DirectionalLight
      ) as THREE.DirectionalLight;
      const target = group.children.find((child) => child.name.endsWith('_target'));

      expect(light.target).toBe(target);
    });

    it('should configure orthographic shadow camera when shadows enabled', () => {
      const properties: DirectionalLight3DProperties = {
        name: 'Sun',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: true,
        shadow_bias: 0.05,
        shadow_filter: 2,
        directional_shadow_max_distance: 200,
      };

      const group = createDirectionalLight3D('Sun', properties);
      const light = group.children.find(
        (child) => child instanceof THREE.DirectionalLight
      ) as THREE.DirectionalLight;

      expect(light.castShadow).toBe(true);

      // Check orthographic camera frustum
      expect(light.shadow.camera.left).toBe(-20);
      expect(light.shadow.camera.right).toBe(20);
      expect(light.shadow.camera.top).toBe(20);
      expect(light.shadow.camera.bottom).toBe(-20);
      expect(light.shadow.camera.near).toBe(0.1);
      expect(light.shadow.camera.far).toBe(200);

      // Check shadow map size
      expect(light.shadow.mapSize.width).toBe(1024); // filter=2 -> 1024
      expect(light.shadow.mapSize.height).toBe(1024);

      // Check shadow bias
      expect(light.shadow.bias).toBeCloseTo(-0.0005, 6); // -0.05 * 0.01

      expect(light.shadow.radius).toBe(4);
    });

    it('should not enable shadows when shadow_enabled is false', () => {
      const properties: DirectionalLight3DProperties = {
        name: 'Sun',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: false,
      };

      const group = createDirectionalLight3D('Sun', properties);
      const light = group.children.find(
        (child) => child instanceof THREE.DirectionalLight
      ) as THREE.DirectionalLight;

      expect(light.castShadow).toBe(false);
    });

    it('should use default shadow far when max_distance not specified', () => {
      const properties: DirectionalLight3DProperties = {
        name: 'Sun',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: true,
      };

      const group = createDirectionalLight3D('Sun', properties);
      const light = group.children.find(
        (child) => child instanceof THREE.DirectionalLight
      ) as THREE.DirectionalLight;

      expect(light.shadow.camera.far).toBe(100); // Default
    });

    it('should use default shadow bias when not specified', () => {
      const properties: DirectionalLight3DProperties = {
        name: 'Sun',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: true,
      };

      const group = createDirectionalLight3D('Sun', properties);
      const light = group.children.find(
        (child) => child instanceof THREE.DirectionalLight
      ) as THREE.DirectionalLight;

      expect(light.shadow.bias).toBe(-0.0005);
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
        const properties: DirectionalLight3DProperties = {
          name: 'Sun',
          light_color: 'Color(1, 1, 1, 1)',
          light_energy: 1.0,
          shadow_enabled: true,
          shadow_filter: filter,
        };

        const group = createDirectionalLight3D('Sun', properties);
        const light = group.children.find(
          (child) => child instanceof THREE.DirectionalLight
        ) as THREE.DirectionalLight;

        expect(light.shadow.mapSize.width).toBe(expectedSize);
        expect(light.shadow.mapSize.height).toBe(expectedSize);
      });
    });

    it('should handle white light color', () => {
      const properties: DirectionalLight3DProperties = {
        name: 'Sun',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: false,
      };

      const group = createDirectionalLight3D('Sun', properties);
      const light = group.children.find(
        (child) => child instanceof THREE.DirectionalLight
      ) as THREE.DirectionalLight;

      expect(light.color.getHex()).toBe(0xffffff);
    });

    it('should handle colored light', () => {
      const properties: DirectionalLight3DProperties = {
        name: 'Moon',
        light_color: 'Color(0.7, 0.7, 0.9, 1)', // Blueish moonlight
        light_energy: 0.5,
        shadow_enabled: false,
      };

      const group = createDirectionalLight3D('Moon', properties);
      const light = group.children.find(
        (child) => child instanceof THREE.DirectionalLight
      ) as THREE.DirectionalLight;

      expect(light.color.getHex()).toBe(0xb3b3e6);
    });
  });

  describe('positionLightTarget', () => {
    it('should position target based on quaternion', () => {
      const properties: DirectionalLight3DProperties = {
        name: 'Sun',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: false,
      };

      const group = createDirectionalLight3D('Sun', properties);

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
      const properties: DirectionalLight3DProperties = {
        name: 'Sun',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: false,
      };

      const group = createDirectionalLight3D('Sun', properties);

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
      const properties: DirectionalLight3DProperties = {
        name: 'Sun',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1.0,
        shadow_enabled: false,
      };

      const group = createDirectionalLight3D('Sun', properties);
      const quaternion = new THREE.Quaternion();
      positionLightTarget(group, quaternion, 50);

      const target = group.children.find((child) => child.name.endsWith('_target'));
      expect(target).toBeDefined();

      expect(target!.position.z).toBeCloseTo(-50, 5);
    });
  });
});
