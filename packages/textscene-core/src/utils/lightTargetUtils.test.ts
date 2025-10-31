/**
 * Tests for light target utilities
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createLightWithTarget, positionLightTarget } from './lightTargetUtils';

describe('lightTargetUtils', () => {
  describe('createLightWithTarget', () => {
    it('should create a Group with SpotLight and target', () => {
      const light = new THREE.SpotLight(0xffffff, 1);
      light.name = 'TestLight';

      const group = createLightWithTarget(light, 'TestLight');

      expect(group).toBeInstanceOf(THREE.Group);
      expect(group.name).toBe('TestLight');
      expect(group.children).toHaveLength(2);
    });

    it('should create a Group with DirectionalLight and target', () => {
      const light = new THREE.DirectionalLight(0xffffff, 1);
      light.name = 'Sun';

      const group = createLightWithTarget(light, 'Sun');

      expect(group).toBeInstanceOf(THREE.Group);
      expect(group.name).toBe('Sun');
      expect(group.children).toHaveLength(2);
    });

    it('should add light to group', () => {
      const light = new THREE.SpotLight(0xffffff, 1);
      light.name = 'TestLight';

      const group = createLightWithTarget(light, 'TestLight');
      const foundLight = group.children.find((child) => child === light);

      expect(foundLight).toBe(light);
    });

    it('should create target with correct name', () => {
      const light = new THREE.SpotLight(0xffffff, 1);
      light.name = 'TestLight';

      const group = createLightWithTarget(light, 'TestLight');
      const target = group.children.find((child) => child.name === 'TestLight_target');

      expect(target).toBeDefined();
      expect(target).toBeInstanceOf(THREE.Object3D);
    });

    it('should link light to target', () => {
      const light = new THREE.SpotLight(0xffffff, 1);
      light.name = 'TestLight';

      const group = createLightWithTarget(light, 'TestLight');
      const target = group.children.find((child) => child.name === 'TestLight_target');

      expect(light.target).toBe(target);
    });

    it('should work with different node names', () => {
      const light = new THREE.DirectionalLight(0xffffff, 1);

      const group = createLightWithTarget(light, 'MyCustomLight');
      const target = group.children.find((child) => child.name.endsWith('_target'));

      expect(group.name).toBe('MyCustomLight');
      expect(target?.name).toBe('MyCustomLight_target');
    });
  });

  describe('positionLightTarget', () => {
    it('should position target with identity quaternion (no rotation)', () => {
      const light = new THREE.SpotLight(0xffffff, 1);
      const group = createLightWithTarget(light, 'TestLight');

      const quaternion = new THREE.Quaternion(); // Identity rotation
      positionLightTarget(group, quaternion, 10);

      const target = group.children.find((child) => child.name.endsWith('_target'));

      expect(target).toBeDefined();
      // Forward is -Z in Godot
      expect(target!.position.x).toBeCloseTo(0, 5);
      expect(target!.position.y).toBeCloseTo(0, 5);
      expect(target!.position.z).toBeCloseTo(-10, 5);
    });

    it('should position target with 90 degree Y rotation', () => {
      const light = new THREE.DirectionalLight(0xffffff, 1);
      const group = createLightWithTarget(light, 'Sun');

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
      const light = new THREE.SpotLight(0xffffff, 1);
      const group = createLightWithTarget(light, 'TestLight');

      const quaternion = new THREE.Quaternion();
      positionLightTarget(group, quaternion, 50);

      const target = group.children.find((child) => child.name.endsWith('_target'));

      expect(target).toBeDefined();
      expect(target!.position.z).toBeCloseTo(-50, 5);
    });

    it('should use default distance of 10 when not specified', () => {
      const light = new THREE.SpotLight(0xffffff, 1);
      const group = createLightWithTarget(light, 'TestLight');

      const quaternion = new THREE.Quaternion();
      positionLightTarget(group, quaternion); // No distance specified

      const target = group.children.find((child) => child.name.endsWith('_target'));

      expect(target).toBeDefined();
      expect(target!.position.z).toBeCloseTo(-10, 5);
    });

    it('should handle 180 degree rotation', () => {
      const light = new THREE.DirectionalLight(0xffffff, 1);
      const group = createLightWithTarget(light, 'Sun');

      // 180 degrees around Y axis
      const quaternion = new THREE.Quaternion();
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
      positionLightTarget(group, quaternion, 10);

      const target = group.children.find((child) => child.name.endsWith('_target'));

      expect(target).toBeDefined();
      // Should point in +Z direction after 180 degree Y rotation
      expect(target!.position.x).toBeCloseTo(0, 5);
      expect(target!.position.y).toBeCloseTo(0, 5);
      expect(target!.position.z).toBeCloseTo(10, 5);
    });

    it('should not throw when target is missing', () => {
      const group = new THREE.Group();
      const quaternion = new THREE.Quaternion();

      // Should log warning but not throw
      expect(() => positionLightTarget(group, quaternion, 10)).not.toThrow();
    });

    it('should work with complex rotations', () => {
      const light = new THREE.SpotLight(0xffffff, 1);
      const group = createLightWithTarget(light, 'TestLight');

      // 45 degrees X, 45 degrees Y
      const quaternion = new THREE.Quaternion();
      const euler = new THREE.Euler(Math.PI / 4, Math.PI / 4, 0);
      quaternion.setFromEuler(euler);

      positionLightTarget(group, quaternion, 10);

      const target = group.children.find((child) => child.name.endsWith('_target'));

      expect(target).toBeDefined();
      // Verify target is positioned (exact values depend on rotation math)
      const distance = target!.position.length();
      expect(distance).toBeCloseTo(10, 1); // Distance should be ~10
    });
  });
});
