/**
 * Camera3D renderer - creates three.js cameras with visualization helpers
 *
 * Architecture: Cameras are no longer wrapped in Groups. Transform is applied directly
 * to the camera, and offsets are applied in the camera's LOCAL coordinate system
 * (matching Godot's implementation). Helpers are stored in userData for scene-level
 * registration.
 */

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

  // Apply transform directly to camera (no group wrapper)
  applyNode3DTransform(camera, properties);

  // CRITICAL FIX: Apply offsets in camera's LOCAL coordinate system
  // This matches Godot's _get_adjusted_camera_transform() implementation:
  //   tr.origin += tr.basis.get_column(1) * v_offset;  // Y-axis offset
  //   tr.origin += tr.basis.get_column(0) * h_offset;  // X-axis offset
  if ((properties.h_offset !== 0 || properties.v_offset !== 0) && properties.transform) {
    // Use basis vectors directly from transform (Godot's basis columns = local axes)
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

    // Apply offsets along camera's local axes (basis columns) to camera's position
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
 * Log detailed transform information for debugging
 */
function logCameraTransforms(
  name: string,
  camera: THREE.Camera,
  properties: Camera3DProperties
): void {
  const cameraWorldPos = new THREE.Vector3();
  const cameraWorldQuat = new THREE.Quaternion();
  camera.getWorldPosition(cameraWorldPos);
  camera.getWorldQuaternion(cameraWorldQuat);

  info(`\n${'='.repeat(80)}`);
  info(`[Camera3D] ${name} - Debug Transform Report`);
  info(`${'='.repeat(80)}`);

  // Log original Godot transform
  info(`\n[Godot Transform3D from TSCN]:`);
  if (properties.transform) {
    const t = properties.transform;
    info(`  Basis X: (${t.basis_x.x.toFixed(3)}, ${t.basis_x.y.toFixed(3)}, ${t.basis_x.z.toFixed(3)})`);
    info(`  Basis Y: (${t.basis_y.x.toFixed(3)}, ${t.basis_y.y.toFixed(3)}, ${t.basis_y.z.toFixed(3)})`);
    info(`  Basis Z: (${t.basis_z.x.toFixed(3)}, ${t.basis_z.y.toFixed(3)}, ${t.basis_z.z.toFixed(3)})`);
    info(`  Origin: (${t.origin.x.toFixed(2)}, ${t.origin.y.toFixed(2)}, ${t.origin.z.toFixed(2)})`);
  } else {
    info(`  <Identity transform - no transform property in TSCN>`);
  }

  // Log camera offsets
  info(`\n[Camera Offsets Applied in LOCAL Space]:`);
  info(`  h_offset: ${properties.h_offset.toFixed(2)} (applied along camera's LOCAL X-axis)`);
  info(`  v_offset: ${properties.v_offset.toFixed(2)} (applied along camera's LOCAL Y-axis)`);
  info(`  frustum_offset: (${properties.frustum_offset.x.toFixed(2)}, ${properties.frustum_offset.y.toFixed(2)})`);

  // Log camera properties
  info(`\n[Camera Properties]:`);
  info(`  Projection: ${properties.projection === 0 ? 'Perspective' : 'Orthogonal'}`);
  if (properties.projection === 0) {
    info(`  FOV: ${properties.fov.toFixed(2)}°`);
  } else {
    info(`  Size: ${properties.size.toFixed(2)}`);
  }
  info(`  Near: ${properties.near.toFixed(2)}, Far: ${properties.far.toFixed(2)}`);

  // Log Camera transform
  info(`\n[Camera Transform]:`);
  info(`  Local Position: (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`);
  info(`  Local Rotation: (${camera.rotation.x.toFixed(2)}, ${camera.rotation.y.toFixed(2)}, ${camera.rotation.z.toFixed(2)})`);
  info(`  Local Scale: (${camera.scale.x.toFixed(2)}, ${camera.scale.y.toFixed(2)}, ${camera.scale.z.toFixed(2)})`);
  info(`  World Position: (${cameraWorldPos.x.toFixed(2)}, ${cameraWorldPos.y.toFixed(2)}, ${cameraWorldPos.z.toFixed(2)})`);
  info(`  World Quaternion: (${cameraWorldQuat.x.toFixed(3)}, ${cameraWorldQuat.y.toFixed(3)}, ${cameraWorldQuat.z.toFixed(3)}, ${cameraWorldQuat.w.toFixed(3)})`);
  info(`  matrixAutoUpdate: ${camera.matrixAutoUpdate}`);

  // Log matrix elements
  info(`\n[Camera Matrix Elements]:`);
  const cm = camera.matrix.elements;
  info(`  [${cm[0].toFixed(3)}, ${cm[4].toFixed(3)}, ${cm[8].toFixed(3)}, ${cm[12].toFixed(3)}]`);
  info(`  [${cm[1].toFixed(3)}, ${cm[5].toFixed(3)}, ${cm[9].toFixed(3)}, ${cm[13].toFixed(3)}]`);
  info(`  [${cm[2].toFixed(3)}, ${cm[6].toFixed(3)}, ${cm[10].toFixed(3)}, ${cm[14].toFixed(3)}]`);
  info(`  [${cm[3].toFixed(3)}, ${cm[7].toFixed(3)}, ${cm[11].toFixed(3)}, ${cm[15].toFixed(3)}]`);

  info(`\n[Helper Status]:`);
  info(`  Stored in camera.userData.helper for scene-level registration`);
  info(`  Helper will be added to scene root by TscnRenderer`);

  info(`${'='.repeat(80)}\n`);
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
