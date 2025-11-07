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

    it('should create CameraHelper with default visibility OFF', () => {
      const group = createCamera3D('Camera', baseCameraProps);
      const helper = getHelperFromGroup(group);

      expect(helper).toBeInstanceOf(THREE.CameraHelper);
      expect(helper!.visible).toBe(false); // Default OFF for clean preview
    });

    it('should apply transform to group', () => {
      const group = createCamera3D('Camera', baseCameraProps);

      expect(group.position.x).toBeCloseTo(0);
      expect(group.position.y).toBeCloseTo(5);
      expect(group.position.z).toBeCloseTo(10);
    });

    it('should apply h_offset and v_offset', () => {
      const propsWithOffset: Camera3DProperties = {
        ...baseCameraProps,
        h_offset: 2.0,
        v_offset: -1.0,
      };

      const group = createCamera3D('Camera', propsWithOffset);

      expect(group.position.x).toBeCloseTo(2.0);
      expect(group.position.y).toBeCloseTo(4.0); // 5 + (-1)
      expect(group.position.z).toBeCloseTo(10);
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
});
