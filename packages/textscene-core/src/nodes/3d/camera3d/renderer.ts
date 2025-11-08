/**
 * Camera3D renderer - creates three.js cameras with visualization helpers
 */

import * as THREE from 'three';
import type { Camera3DProperties } from './types';
import { ProjectionMode } from './types';
import { applyNode3DTransform } from '../../base/node3d/renderer';

const DEFAULT_ASPECT = 16 / 9;

/**
 * Create a Camera3D with visualization helper
 * Returns a Group containing the camera and a CameraHelper for visualization
 */
export function createCamera3D(name: string, properties: Camera3DProperties): THREE.Group {
  const group = new THREE.Group();
  group.name = name;

  // Create the appropriate camera type
  const camera = createCameraByProjection(properties);
  camera.name = `${name}_camera`;

  // Create camera helper for visualization
  const helper = new THREE.CameraHelper(camera);
  helper.name = `${name}_helper`;
  helper.visible = true; // Visible by default to show camera positioning

  // Scale down helper to avoid dominating the scene visually
  // This makes helper lines ~10 units long regardless of camera's far plane
  helper.scale.set(0.2, 0.2, 0.2);

  // Apply transform to camera, not group - this ensures helper visualizes correctly
  applyNode3DTransform(camera, properties);

  // Apply offsets to camera
  if (properties.h_offset !== 0 || properties.v_offset !== 0) {
    camera.position.x += properties.h_offset;
    camera.position.y += properties.v_offset;
  }

  // Add camera to group (camera now has the transform)
  group.add(camera);

  // Update camera's matrices before creating/updating helper
  camera.updateMatrixWorld(true);

  // Update helper to reflect the camera's transform
  helper.update();

  // Add helper to group (helper visualizes the already-transformed camera)
  group.add(helper);

  // Store properties and references in userData (THREE.js idiomatic pattern)
  group.userData.nodeType = 'Camera3D';
  group.userData.cameraProperties = properties;
  group.userData.camera = camera;
  group.userData.helper = helper;

  // Provide custom highlight target - highlight the frustum helper instead of the group
  group.userData.getHighlightTarget = () => helper;

  return group;
}

/**
 * Create camera based on projection mode
 */
function createCameraByProjection(properties: Camera3DProperties): THREE.Camera {
  if (properties.projection === ProjectionMode.PROJECTION_PERSPECTIVE) {
    return createPerspectiveCamera(properties);
  } else if (properties.projection === ProjectionMode.PROJECTION_ORTHOGONAL) {
    return createOrthographicCamera(properties);
  } else {
    // PROJECTION_FRUSTUM not yet supported, default to perspective
    return createPerspectiveCamera(properties);
  }
}

/**
 * Create a three.js PerspectiveCamera
 */
function createPerspectiveCamera(properties: Camera3DProperties): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(
    properties.fov,
    DEFAULT_ASPECT,
    Math.max(0.001, properties.near), // Ensure near > 0
    Math.max(properties.near + 0.1, properties.far) // Ensure far > near
  );

  camera.updateProjectionMatrix();
  return camera;
}

/**
 * Create a three.js OrthographicCamera
 */
function createOrthographicCamera(properties: Camera3DProperties): THREE.OrthographicCamera {
  const halfHeight = properties.size;
  const halfWidth = properties.size * DEFAULT_ASPECT;

  const camera = new THREE.OrthographicCamera(
    -halfWidth,
    halfWidth,
    halfHeight,
    -halfHeight,
    Math.max(0.001, properties.near),
    Math.max(properties.near + 0.1, properties.far)
  );

  camera.updateProjectionMatrix();
  return camera;
}

/**
 * Update camera aspect ratio (for window resize)
 */
export function updateCameraAspect(group: THREE.Group, aspect: number): void {
  const camera = group.userData.camera as THREE.Camera | undefined;
  const properties = group.userData.cameraProperties as Camera3DProperties | undefined;

  if (!camera || !properties) return;

  if (camera instanceof THREE.PerspectiveCamera) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  } else if (camera instanceof THREE.OrthographicCamera) {
    const halfHeight = properties.size;
    const halfWidth = properties.size * aspect;

    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
  }

  // Update helper
  const helper = group.userData.helper as THREE.CameraHelper | undefined;
  if (helper) {
    helper.update();
  }
}

/**
 * Get the actual camera from a Camera3D group
 */
export function getCameraFromGroup(group: THREE.Group): THREE.Camera | null {
  return (group.userData.camera as THREE.Camera) || null;
}

/**
 * Get the helper from a Camera3D group
 */
export function getHelperFromGroup(group: THREE.Group): THREE.CameraHelper | null {
  return (group.userData.helper as THREE.CameraHelper) || null;
}

/**
 * Show/hide camera helper
 */
export function setHelperVisibility(group: THREE.Group, visible: boolean): void {
  const helper = getHelperFromGroup(group);
  if (helper) {
    helper.visible = visible;
  }
}
