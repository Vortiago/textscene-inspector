/**
 * Camera3D renderer tests
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCamera3D, updateCameraAspect } from './renderer';
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
    it('should create a camera with helper', () => {
      const camera = createCamera3D('MainCamera', baseCameraProps);

      expect(camera).toBeInstanceOf(THREE.Camera);
      expect(camera.name).toBe('MainCamera');
      expect(camera.userData.nodeType).toBe('Camera3D');
      expect(camera.userData.helper).toBeInstanceOf(THREE.CameraHelper);
    });

    it('should create PerspectiveCamera for perspective projection', () => {
      const camera = createCamera3D('Camera', baseCameraProps);

      expect(camera).toBeInstanceOf(THREE.PerspectiveCamera);
      expect((camera as THREE.PerspectiveCamera).fov).toBe(75.0);
      expect(camera.near).toBe(0.05);
      expect(camera.far).toBe(4000.0);
    });

    it('should create OrthographicCamera for orthogonal projection', () => {
      const orthoProps: Camera3DProperties = {
        ...baseCameraProps,
        projection: ProjectionMode.PROJECTION_ORTHOGONAL,
        size: 5.0,
      };

      const camera = createCamera3D('OrthoCamera', orthoProps);

      expect(camera).toBeInstanceOf(THREE.OrthographicCamera);
      const orthoCam = camera as THREE.OrthographicCamera;
      expect(orthoCam.top).toBe(5.0);
      expect(orthoCam.bottom).toBe(-5.0);
    });

    it('should create CameraHelper with default visibility ON', () => {
      const camera = createCamera3D('Camera', baseCameraProps);
      const helper = camera.userData.helper as THREE.CameraHelper;

      expect(helper).toBeInstanceOf(THREE.CameraHelper);
      expect(helper.visible).toBe(true); // Default ON to show camera positioning
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

      const camera = createCamera3D('RotatedCamera', rotatedProps);
      const helper = camera.userData.helper as THREE.CameraHelper;

      expect(camera).toBeDefined();
      expect(helper).toBeDefined();

      // Force matrix update (simulates being added to scene)
      camera.updateMatrixWorld(true);
      helper.updateMatrixWorld(true);

      // Camera should be at world position (10, 5, 0)
      const cameraWorldPos = new THREE.Vector3();
      camera.getWorldPosition(cameraWorldPos);
      expect(cameraWorldPos.x).toBeCloseTo(10);
      expect(cameraWorldPos.y).toBeCloseTo(5);
      expect(cameraWorldPos.z).toBeCloseTo(0);
    });

    it('should apply transform to camera directly', () => {
      const camera = createCamera3D('Camera', baseCameraProps);

      expect(camera).toBeDefined();
      // Transform is applied directly to camera
      expect(camera.position.x).toBeCloseTo(0);
      expect(camera.position.y).toBeCloseTo(5);
      expect(camera.position.z).toBeCloseTo(10);
    });

    it('should apply h_offset and v_offset in camera LOCAL space', () => {
      const propsWithOffset: Camera3DProperties = {
        ...baseCameraProps,
        h_offset: 2.0,
        v_offset: -1.0,
      };

      const camera = createCamera3D('Camera', propsWithOffset);

      expect(camera).toBeDefined();
      // With identity rotation, local axes = world axes
      // So offsets should be (h_offset, v_offset, 0) added to position
      expect(camera.position.x).toBeCloseTo(2.0); // 0 + 2.0 (h_offset along X)
      expect(camera.position.y).toBeCloseTo(4.0); // 5 + -1.0 (v_offset along Y)
      expect(camera.position.z).toBeCloseTo(10); // unchanged
    });

    it('should apply offsets in local space with rotated camera', () => {
      // Camera rotated 90° around Y (looking along +X in world space)
      const rotatedProps: Camera3DProperties = {
        ...baseCameraProps,
        transform: {
          basis_x: { x: 0, y: 0, z: 1 }, // 90° Y rotation
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: -1, y: 0, z: 0 },
          origin: { x: 0, y: 0, z: 0 },
        },
        h_offset: 2.0,  // Along camera's local X (world +Z)
        v_offset: 1.0,  // Along camera's local Y (world +Y)
      };

      const camera = createCamera3D('RotatedCamera', rotatedProps);
      camera.updateMatrixWorld(true);

      // With 90° Y rotation and offsets:
      // h_offset along local X = world +Z
      // v_offset along local Y = world +Y
      expect(camera.position.x).toBeCloseTo(0, 1);   // No X offset
      expect(camera.position.y).toBeCloseTo(1, 1);   // v_offset (1.0)
      expect(camera.position.z).toBeCloseTo(2, 1);   // h_offset (2.0)
    });

    it('should enforce near > 0 constraint', () => {
      const propsWithBadNear: Camera3DProperties = {
        ...baseCameraProps,
        near: -1.0,
      };

      const camera = createCamera3D('Camera', propsWithBadNear);

      expect(camera.near).toBeGreaterThan(0);
    });

    it('should enforce far > near constraint', () => {
      const propsWithBadFar: Camera3DProperties = {
        ...baseCameraProps,
        near: 100.0,
        far: 50.0,
      };

      const camera = createCamera3D('Camera', propsWithBadFar);

      expect(camera.far).toBeGreaterThan(camera.near);
    });

    it('should store properties and references in userData', () => {
      const camera = createCamera3D('Camera', baseCameraProps);

      expect(camera.userData.cameraProperties).toBeDefined();
      expect(camera.userData.cameraProperties.fov).toBe(75.0);
      expect(camera.userData.helper).toBeDefined();
      expect(camera.userData.nodeType).toBe('Camera3D');
    });
  });

  describe('updateCameraAspect', () => {
    it('should update perspective camera aspect', () => {
      const camera = createCamera3D('Camera', baseCameraProps);
      updateCameraAspect(camera, 4 / 3);

      expect((camera as THREE.PerspectiveCamera).aspect).toBeCloseTo(4 / 3);
    });

    it('should update orthographic camera frustum', () => {
      const orthoProps: Camera3DProperties = {
        ...baseCameraProps,
        projection: ProjectionMode.PROJECTION_ORTHOGONAL,
        size: 5.0,
      };

      const camera = createCamera3D('OrthoCamera', orthoProps);
      updateCameraAspect(camera, 2.0);

      const orthoCam = camera as THREE.OrthographicCamera;
      expect(orthoCam.right).toBeCloseTo(10.0); // 5.0 * 2.0
      expect(orthoCam.left).toBeCloseTo(-10.0);
      expect(orthoCam.top).toBeCloseTo(5.0);
      expect(orthoCam.bottom).toBeCloseTo(-5.0);
    });

    it('should update helper after aspect change', () => {
      const camera = createCamera3D('Camera', baseCameraProps);
      const helper = camera.userData.helper as THREE.CameraHelper;

      expect(() => updateCameraAspect(camera, 1.5)).not.toThrow();
      expect(helper).toBeDefined(); // Helper should still exist
    });

    it('should handle missing properties gracefully', () => {
      const emptyCamera = new THREE.PerspectiveCamera();
      expect(() => updateCameraAspect(emptyCamera, 1.5)).not.toThrow();
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

      const camera = createCamera3D('Camera', cameraProps);
      parent.add(camera);

      // Update world matrices (simulates being in a scene)
      parent.updateMatrixWorld(true);

      // Get camera's world position
      const worldPos = new THREE.Vector3();
      camera.getWorldPosition(worldPos);

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

      const camera = createCamera3D('Camera', cameraProps);
      parent.add(camera);
      parent.updateMatrixWorld(true);

      // Get world quaternion
      const worldQuat = new THREE.Quaternion();
      camera.getWorldQuaternion(worldQuat);

      // World rotation should be composition of parent and camera rotations
      // The actual values depend on rotation order, but we verify it's not identity
      const identityQuat = new THREE.Quaternion();
      expect(worldQuat.equals(identityQuat)).toBe(false);

      // Also verify the camera's local rotation is preserved
      const localQuat = camera.quaternion.clone();
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

      const camera = createCamera3D('Camera', cameraProps);
      container.add(camera);
      root.updateMatrixWorld(true);

      const worldPos = new THREE.Vector3();
      camera.getWorldPosition(worldPos);

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

      const camera = createCamera3D('Camera', cameraProps);
      parent.add(camera);
      parent.updateMatrixWorld(true);

      // Extract world transform (like CameraManager does)
      const worldPosition = new THREE.Vector3();
      const worldQuaternion = new THREE.Quaternion();
      const worldScale = new THREE.Vector3();
      camera.getWorldPosition(worldPosition);
      camera.getWorldQuaternion(worldQuaternion);
      camera.getWorldScale(worldScale);

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

    it('should have helper reference camera correctly when parent has transform', () => {
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

      const camera = createCamera3D('Camera', cameraProps);
      parent.add(camera);
      parent.updateMatrixWorld(true);

      const helper = camera.userData.helper as THREE.CameraHelper;

      expect(camera).toBeDefined();
      expect(helper).toBeDefined();

      // Helper should reference the camera
      expect(helper.camera).toBe(camera);

      // Camera has the transform position
      expect(camera.position.y).toBeCloseTo(5);
    });
  });
});
