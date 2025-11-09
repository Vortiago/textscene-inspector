/**
 * Camera3D renderer - creates three.js cameras with visualization helpers
 */

import * as THREE from 'three';
import type { Camera3DProperties } from './types';
import { ProjectionMode } from './types';
import { applyNode3DTransform } from '../../base/node3d/renderer';
import { info } from '../../../logger';

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

  // Apply transform to group (not camera) so it inherits parent hierarchy correctly
  applyNode3DTransform(group, properties);

  // Apply offsets to camera (offsets are in camera's local space)
  if (properties.h_offset !== 0 || properties.v_offset !== 0) {
    camera.position.x += properties.h_offset;
    camera.position.y += properties.v_offset;
  }

  // Add camera to group
  group.add(camera);

  // Create helper - it will track the camera automatically
  const helper = new THREE.CameraHelper(camera);
  helper.name = `${name}_helper`;
  helper.visible = true;

  // CRITICAL: Reset helper's position to origin
  // CameraHelper calculates geometry based on camera's world matrix,
  // but we want it positioned at the group's origin, not offset
  helper.position.set(0, 0, 0);
  helper.rotation.set(0, 0, 0);
  helper.scale.set(1, 1, 1);

  // Add helper to group
  group.add(helper);

  // Log transforms for debugging camera helper positioning
  const groupWorldPos = new THREE.Vector3();
  const cameraWorldPos = new THREE.Vector3();
  const helperWorldPos = new THREE.Vector3();
  group.getWorldPosition(groupWorldPos);
  camera.getWorldPosition(cameraWorldPos);
  helper.getWorldPosition(helperWorldPos);

  info(`[Camera3D] ${name} transforms:`);
  info(`  Group local: pos(${group.position.x.toFixed(2)}, ${group.position.y.toFixed(2)}, ${group.position.z.toFixed(2)})`);
  info(`  Group world: pos(${groupWorldPos.x.toFixed(2)}, ${groupWorldPos.y.toFixed(2)}, ${groupWorldPos.z.toFixed(2)})`);
  info(`  Camera local: pos(${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`);
  info(`  Camera world: pos(${cameraWorldPos.x.toFixed(2)}, ${cameraWorldPos.y.toFixed(2)}, ${cameraWorldPos.z.toFixed(2)})`);
  info(`  Helper local: pos(${helper.position.x.toFixed(2)}, ${helper.position.y.toFixed(2)}, ${helper.position.z.toFixed(2)})`);
  info(`  Helper world: pos(${helperWorldPos.x.toFixed(2)}, ${helperWorldPos.y.toFixed(2)}, ${helperWorldPos.z.toFixed(2)})`);

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
