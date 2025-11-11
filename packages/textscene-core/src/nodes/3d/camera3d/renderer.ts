/** Creates three.js cameras with visualization helpers for Camera3D nodes */

import * as THREE from 'three';
import type { Camera3DProperties } from './types';
import { ProjectionMode } from './types';
import { applyNode3DTransform } from '../../base/node3d/renderer';
import { info } from '../../../logger';

const DEFAULT_ASPECT = 16 / 9;

/**
 * Create a Camera3D with visualization helper
 * Returns a Camera (not a Group!) with helper stored in userData
 */
export function createCamera3D(name: string, properties: Camera3DProperties): THREE.Camera {
  // Create the appropriate camera type
  const camera = createCameraByProjection(properties);
  camera.name = name;

  applyNode3DTransform(camera, properties);

  // Apply h_offset and v_offset in camera's local coordinate system using basis vectors
  if ((properties.h_offset !== 0 || properties.v_offset !== 0) && properties.transform) {
    const localX = new THREE.Vector3(
      properties.transform.basis_x.x,
      properties.transform.basis_x.y,
      properties.transform.basis_x.z
    );
    const localY = new THREE.Vector3(
      properties.transform.basis_y.x,
      properties.transform.basis_y.y,
      properties.transform.basis_y.z
    );

    camera.position.addScaledVector(localX, properties.h_offset);
    camera.position.addScaledVector(localY, properties.v_offset);
  }

  // Create helper and store reference in userData (don't add to scene yet)
  const helper = new THREE.CameraHelper(camera);
  helper.name = `${name}_helper`;
  helper.visible = true;

  // Store in userData for scene-level registration
  camera.userData.nodeType = 'Camera3D';
  camera.userData.cameraProperties = properties;
  camera.userData.helper = helper;

  // Provide custom highlight target for HelperManager
  camera.userData.getHighlightTarget = () => helper;

  // Log transforms for debugging
  logCameraTransforms(name, camera, properties);

  return camera;
}

/**
 * Log camera creation for debugging
 */
function logCameraTransforms(
  name: string,
  camera: THREE.Camera,
  properties: Camera3DProperties
): void {
  const projType = properties.projection === 0 ? 'Perspective' : 'Orthogonal';
  const projDetail = properties.projection === 0 ? `FOV=${properties.fov.toFixed(1)}°` : `Size=${properties.size.toFixed(1)}`;
  const pos = `(${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})`;
  const offsets = properties.h_offset !== 0 || properties.v_offset !== 0
    ? `, offsets=(${properties.h_offset.toFixed(1)}, ${properties.v_offset.toFixed(1)})`
    : '';

  info(`[Camera3D] ${name}: ${projType} ${projDetail}, pos=${pos}${offsets}`);
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
export function updateCameraAspect(camera: THREE.Camera, aspect: number): void {
  const properties = camera.userData.cameraProperties as Camera3DProperties | undefined;
  if (!properties) return;

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

  // Update helper if it exists
  const helper = camera.userData.helper as THREE.CameraHelper | undefined;
  if (helper) {
    helper.update();
  }
}
