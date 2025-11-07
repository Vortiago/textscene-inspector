/**
 * Camera3D renderer tests
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCamera3D, getCameraFromGroup, getHelperFromGroup, setHelperVisibility, updateCameraAspect } from './renderer';
import { ProjectionMode } from './types';
import type { Camera3DProperties } from './types';

describe('Camera3D Renderer', () => {
  const defaultTransform = {
    basis_x: { x: 1, y: 0, z: 0 },
    basis_y: { x: 0, y: 1, z: 0 },
    basis_z: { x: 0, y: 0, z: 1 },
    origin: { x: 0, y: 5, z: 10 },
  };

  const baseCameraProps: Camera3DProperties = {
    name: 'TestCamera',
    projection: ProjectionMode.PROJECTION_PERSPECTIVE,
    fov: 75.0,
    size: 1.0,
    near: 0.05,
    far: 4000.0,
    keep_aspect: 1,
    h_offset: 0,
    v_offset: 0,
    frustum_offset: { x: 0, y: 0 },
    current: false,
    cull_mask: 1048575,
    doppler_tracking: 0,
    transform: defaultTransform,
  };

  describe('createCamera3D', () => {
    it('should create a group with camera and helper', () => {
      const group = createCamera3D('MainCamera', baseCameraProps);

      expect(group).toBeInstanceOf(THREE.Group);
      expect(group.name).toBe('MainCamera');
      expect(group.userData.nodeType).toBe('Camera3D');
    });

    it('should create PerspectiveCamera for perspective projection', () => {
      const group = createCamera3D('Camera', baseCameraProps);
      const camera = getCameraFromGroup(group);

      expect(camera).toBeInstanceOf(THREE.PerspectiveCamera);
      expect((camera as THREE.PerspectiveCamera).fov).toBe(75.0);
      expect(camera!.near).toBe(0.05);
      expect(camera!.far).toBe(4000.0);
    });

    it('should create OrthographicCamera for orthogonal projection', () => {
      const orthoProps: Camera3DProperties = {
        ...baseCameraProps,
        projection: ProjectionMode.PROJECTION_ORTHOGONAL,
        size: 5.0,
      };

      const group = createCamera3D('OrthoCamera', orthoProps);
      const camera = getCameraFromGroup(group);

      expect(camera).toBeInstanceOf(THREE.OrthographicCamera);
      const orthoCam = camera as THREE.OrthographicCamera;
      expect(orthoCam.top).toBe(5.0);
      expect(orthoCam.bottom).toBe(-5.0);
    });

    it('should create CameraHelper with default visibility ON', () => {
      const group = createCamera3D('Camera', baseCameraProps);
      const helper = getHelperFromGroup(group);

      expect(helper).toBeInstanceOf(THREE.CameraHelper);
      expect(helper!.visible).toBe(true); // Default ON to show camera positioning
    });

    it('should update helper to reflect camera world transform', () => {
      // Create camera with 90-degree rotation around Y axis
      const rotatedProps: Camera3DProperties = {
        ...baseCameraProps,
        transform: {
          basis_x: { x: 0, y: 0, z: 1 }, // 90° rotation
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: -1, y: 0, z: 0 },
          origin: { x: 10, y: 5, z: 0 },
        },
      };

      const group = createCamera3D('RotatedCamera', rotatedProps);
      const camera = getCameraFromGroup(group);
      const helper = getHelperFromGroup(group);

      expect(camera).toBeDefined();
      expect(helper).toBeDefined();

      // Force matrix update (simulates being added to scene)
      group.updateMatrixWorld(true);

      // Camera should be at world position (10, 5, 0)
      const cameraWorldPos = new THREE.Vector3();
      camera!.getWorldPosition(cameraWorldPos);
      expect(cameraWorldPos.x).toBeCloseTo(10);
      expect(cameraWorldPos.y).toBeCloseTo(5);
      expect(cameraWorldPos.z).toBeCloseTo(0);

      // Helper should have valid matrix (not zero/identity when camera is transformed)
      // The helper's matrixWorld should match the camera's world transform
      helper!.updateMatrixWorld(true);
      expect(helper!.matrixWorld.equals(new THREE.Matrix4())).toBe(false);
    });

    it('should apply transform to camera', () => {
      const group = createCamera3D('Camera', baseCameraProps);
      const camera = getCameraFromGroup(group);

      expect(camera).toBeDefined();
      expect(camera!.position.x).toBeCloseTo(0);
      expect(camera!.position.y).toBeCloseTo(5);
      expect(camera!.position.z).toBeCloseTo(10);
    });

    it('should apply h_offset and v_offset to camera', () => {
      const propsWithOffset: Camera3DProperties = {
        ...baseCameraProps,
        h_offset: 2.0,
        v_offset: -1.0,
      };

      const group = createCamera3D('Camera', propsWithOffset);
      const camera = getCameraFromGroup(group);

      expect(camera).toBeDefined();
      expect(camera!.position.x).toBeCloseTo(2.0);
      expect(camera!.position.y).toBeCloseTo(4.0); // 5 + (-1)
      expect(camera!.position.z).toBeCloseTo(10);
    });

    it('should enforce near > 0 constraint', () => {
      const propsWithBadNear: Camera3DProperties = {
        ...baseCameraProps,
        near: -1.0,
      };

      const group = createCamera3D('Camera', propsWithBadNear);
      const camera = getCameraFromGroup(group);

      expect(camera!.near).toBeGreaterThan(0);
    });

    it('should enforce far > near constraint', () => {
      const propsWithBadFar: Camera3DProperties = {
        ...baseCameraProps,
        near: 100.0,
        far: 50.0,
      };

      const group = createCamera3D('Camera', propsWithBadFar);
      const camera = getCameraFromGroup(group);

      expect(camera!.far).toBeGreaterThan(camera!.near);
    });

    it('should store properties and references in userData', () => {
      const group = createCamera3D('Camera', baseCameraProps);

      expect(group.userData.cameraProperties).toBeDefined();
      expect(group.userData.cameraProperties.fov).toBe(75.0);
      expect(group.userData.camera).toBeDefined();
      expect(group.userData.helper).toBeDefined();
    });
  });

  describe('getCameraFromGroup', () => {
    it('should extract camera from group', () => {
      const group = createCamera3D('Camera', baseCameraProps);
      const camera = getCameraFromGroup(group);

      expect(camera).toBeInstanceOf(THREE.Camera);
      expect(camera!.name).toBe('Camera_camera');
    });

    it('should return null if no camera found', () => {
      const emptyGroup = new THREE.Group();
      const camera = getCameraFromGroup(emptyGroup);

      expect(camera).toBeNull();
    });
  });

  describe('getHelperFromGroup', () => {
    it('should extract helper from group', () => {
      const group = createCamera3D('Camera', baseCameraProps);
      const helper = getHelperFromGroup(group);

      expect(helper).toBeInstanceOf(THREE.CameraHelper);
      expect(helper!.name).toBe('Camera_helper');
    });

    it('should return null if no helper found', () => {
      const emptyGroup = new THREE.Group();
      const helper = getHelperFromGroup(emptyGroup);

      expect(helper).toBeNull();
    });
  });

  describe('setHelperVisibility', () => {
    it('should show helper', () => {
      const group = createCamera3D('Camera', baseCameraProps);
      setHelperVisibility(group, true);

      const helper = getHelperFromGroup(group);
      expect(helper!.visible).toBe(true);
    });

    it('should hide helper', () => {
      const group = createCamera3D('Camera', baseCameraProps);
      setHelperVisibility(group, false);

      const helper = getHelperFromGroup(group);
      expect(helper!.visible).toBe(false);
    });

    it('should handle missing helper gracefully', () => {
      const emptyGroup = new THREE.Group();
      expect(() => setHelperVisibility(emptyGroup, false)).not.toThrow();
    });
  });

  describe('updateCameraAspect', () => {
    it('should update perspective camera aspect', () => {
      const group = createCamera3D('Camera', baseCameraProps);
      updateCameraAspect(group, 4 / 3);

      const camera = getCameraFromGroup(group) as THREE.PerspectiveCamera;
      expect(camera.aspect).toBeCloseTo(4 / 3);
    });

    it('should update orthographic camera frustum', () => {
      const orthoProps: Camera3DProperties = {
        ...baseCameraProps,
        projection: ProjectionMode.PROJECTION_ORTHOGONAL,
        size: 5.0,
      };

      const group = createCamera3D('OrthoCamera', orthoProps);
      updateCameraAspect(group, 2.0);

      const camera = getCameraFromGroup(group) as THREE.OrthographicCamera;
      expect(camera.right).toBeCloseTo(10.0); // 5.0 * 2.0
      expect(camera.left).toBeCloseTo(-10.0);
      expect(camera.top).toBeCloseTo(5.0);
      expect(camera.bottom).toBeCloseTo(-5.0);
    });

    it('should update helper after aspect change', () => {
      const group = createCamera3D('Camera', baseCameraProps);
      const helper = getHelperFromGroup(group);

      expect(() => updateCameraAspect(group, 1.5)).not.toThrow();
      expect(helper).toBeDefined(); // Helper should still exist
    });

    it('should handle missing properties gracefully', () => {
      const emptyGroup = new THREE.Group();
      expect(() => updateCameraAspect(emptyGroup, 1.5)).not.toThrow();
    });
  });

  describe('Hierarchical Transform Composition', () => {
    it('should compose camera world position with parent Node3D transform', () => {
      // Create parent with transform
      const parent = new THREE.Group();
      parent.position.set(10, 20, 30); // Parent offset

      // Create camera with its own transform
      const cameraProps: Camera3DProperties = {
        ...baseCameraProps,
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 5, y: 5, z: 5 }, // Camera local position
        },
      };

      const cameraGroup = createCamera3D('Camera', cameraProps);
      parent.add(cameraGroup);

      // Update world matrices (simulates being in a scene)
      parent.updateMatrixWorld(true);

      // Get camera's world position
      const camera = getCameraFromGroup(cameraGroup);
      expect(camera).toBeDefined();

      const worldPos = new THREE.Vector3();
      camera!.getWorldPosition(worldPos);

      // World position should be parent + camera local
      expect(worldPos.x).toBeCloseTo(15); // 10 + 5
      expect(worldPos.y).toBeCloseTo(25); // 20 + 5
      expect(worldPos.z).toBeCloseTo(35); // 30 + 5
    });

    it('should compose camera world rotation with parent Node3D rotation', () => {
      // Create parent rotated 90° around Y
      const parent = new THREE.Group();
      parent.rotation.y = Math.PI / 2; // 90° rotation

      // Create camera rotated 90° around X (looking up)
      const cameraProps: Camera3DProperties = {
        ...baseCameraProps,
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 0, z: -1 }, // 90° rotation around X
          basis_z: { x: 0, y: 1, z: 0 },
          origin: { x: 0, y: 0, z: 0 },
        },
      };

      const cameraGroup = createCamera3D('Camera', cameraProps);
      parent.add(cameraGroup);
      parent.updateMatrixWorld(true);

      const camera = getCameraFromGroup(cameraGroup);
      expect(camera).toBeDefined();

      // Get world quaternion
      const worldQuat = new THREE.Quaternion();
      camera!.getWorldQuaternion(worldQuat);

      // World rotation should be composition of parent and camera rotations
      // The actual values depend on rotation order, but we verify it's not identity
      const identityQuat = new THREE.Quaternion();
      expect(worldQuat.equals(identityQuat)).toBe(false);

      // Also verify the camera's local rotation is preserved
      const localQuat = camera!.quaternion.clone();
      expect(localQuat.equals(worldQuat)).toBe(false); // Local ≠ World when there's a parent transform
    });

    it('should compose through multiple levels of hierarchy', () => {
      // Create 3-level hierarchy: Root → Container → Camera
      const root = new THREE.Group();
      root.position.set(100, 0, 0);

      const container = new THREE.Group();
      container.position.set(0, 100, 0);
      root.add(container);

      const cameraProps: Camera3DProperties = {
        ...baseCameraProps,
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 0, y: 0, z: 100 },
        },
      };

      const cameraGroup = createCamera3D('Camera', cameraProps);
      container.add(cameraGroup);
      root.updateMatrixWorld(true);

      const camera = getCameraFromGroup(cameraGroup);
      const worldPos = new THREE.Vector3();
      camera!.getWorldPosition(worldPos);

      // Should compose: root + container + camera
      expect(worldPos.x).toBeCloseTo(100); // from root
      expect(worldPos.y).toBeCloseTo(100); // from container
      expect(worldPos.z).toBeCloseTo(100); // from camera
    });

    it('should work correctly with CameraManager when camera has parent transforms', () => {
      // Simulate what CameraManager does
      const parent = new THREE.Group();
      parent.position.set(50, 50, 50);
      parent.rotation.y = Math.PI / 4; // 45° rotation

      const cameraProps: Camera3DProperties = {
        ...baseCameraProps,
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 0, y: 5, z: 10 },
        },
      };

      const cameraGroup = createCamera3D('Camera', cameraProps);
      parent.add(cameraGroup);
      parent.updateMatrixWorld(true);

      const camera = getCameraFromGroup(cameraGroup);

      // Extract world transform (like CameraManager does)
      const worldPosition = new THREE.Vector3();
      const worldQuaternion = new THREE.Quaternion();
      const worldScale = new THREE.Vector3();
      camera!.getWorldPosition(worldPosition);
      camera!.getWorldQuaternion(worldQuaternion);
      camera!.getWorldScale(worldScale);

      // Verify we got valid world-space values
      expect(worldPosition.length()).toBeGreaterThan(0);
      expect(worldScale.x).toBeCloseTo(1);
      expect(worldScale.y).toBeCloseTo(1);
      expect(worldScale.z).toBeCloseTo(1);

      // Verify world position is not just the local position
      expect(worldPosition.x).not.toBeCloseTo(0);
      expect(worldPosition.y).not.toBeCloseTo(5);
      expect(worldPosition.z).not.toBeCloseTo(10);
    });

    it('should have helper visualize camera correctly when parent has transform', () => {
      // Parent with position and rotation
      const parent = new THREE.Group();
      parent.position.set(10, 10, 10);
      parent.rotation.y = Math.PI / 2;

      const cameraProps: Camera3DProperties = {
        ...baseCameraProps,
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 0, y: 5, z: 0 },
        },
      };

      const cameraGroup = createCamera3D('Camera', cameraProps);
      parent.add(cameraGroup);
      parent.updateMatrixWorld(true);

      const camera = getCameraFromGroup(cameraGroup);
      const helper = getHelperFromGroup(cameraGroup);

      expect(camera).toBeDefined();
      expect(helper).toBeDefined();

      // Helper should be added to the camera group, not to the camera itself
      expect(cameraGroup.children).toContain(helper);

      // Camera should have the local transform from TSCN
      expect(camera!.position.y).toBeCloseTo(5);

      // Helper's matrix should be updated (non-identity when camera is transformed)
      helper!.updateMatrixWorld(true);
      expect(helper!.matrixWorld.equals(new THREE.Matrix4())).toBe(false);
    });
  });
});
