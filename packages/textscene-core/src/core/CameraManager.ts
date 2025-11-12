/**
 * Manages Camera3D nodes and viewport camera switching.
 */

import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { NodeTracker } from './NodeTracker';
import * as logger from '../logger';

// Distance for camera look-at target when switching cameras
const CAMERA_LOOK_DISTANCE = 10;

export interface CameraInfo {
  path: string;
  name: string;
  object: THREE.Object3D;
}

export class CameraManager {
  private nodeTracker: NodeTracker;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;

  constructor(
    nodeTracker: NodeTracker,
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls
  ) {
    this.nodeTracker = nodeTracker;
    this.camera = camera;
    this.controls = controls;
  }

  /**
   * Get all Camera3D nodes in the scene
   */
  getSceneCameras(): CameraInfo[] {
    const cameras: CameraInfo[] = [];

    for (const path of this.nodeTracker.getAllPaths()) {
      const object = this.nodeTracker.getObject(path);
      if (object && object.userData.nodeType === 'Camera3D') {
        cameras.push({
          path,
          name: object.name,
          object,
        });
      }
    }

    return cameras;
  }

  /**
   * Switch to a Camera3D node by path
   * Updates the renderer's active camera and hides the helper for the active camera
   */
  switchToCamera(nodePath: string): boolean {
    logger.info(`[Camera Switch] Switching to camera: ${nodePath}`);

    const camera = this.nodeTracker.getObject(nodePath);
    if (!camera || camera.userData.nodeType !== 'Camera3D') {
      logger.warn(`[Camera Switch] Node not found or not a Camera3D: ${nodePath}`);
      return false;
    }

    if (!(camera instanceof THREE.Camera)) {
      logger.warn(`[Camera Switch] Object is not a THREE.Camera: ${nodePath}`);
      return false;
    }

    // Get helper from userData
    const helper = camera.userData.helper as THREE.CameraHelper | undefined;

    // Show all camera helpers first
    this.showAllCameraHelpers();

    // Hide the helper for the camera we're switching to
    if (helper) {
      helper.visible = false;
    }

    // Get the world position and rotation of the camera
    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    camera.getWorldPosition(worldPosition);
    camera.getWorldQuaternion(worldQuaternion);
    camera.getWorldScale(worldScale);

    // Update the renderer's camera
    this.camera.position.copy(worldPosition);
    this.camera.quaternion.copy(worldQuaternion);
    this.camera.scale.copy(worldScale);

    // Copy projection properties
    if (camera instanceof THREE.PerspectiveCamera && this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.fov = camera.fov;
      this.camera.near = camera.near;
      this.camera.far = camera.far;
      this.camera.updateProjectionMatrix();
    }

    // Update controls target (look at the direction the camera is facing)
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.camera.quaternion);
    this.controls.target.copy(worldPosition).add(direction.multiplyScalar(CAMERA_LOOK_DISTANCE));
    this.controls.update();

    logger.info(`[Camera Switch] Successfully switched to camera: ${nodePath}`);
    return true;
  }

  /**
   * Return to free view (default OrbitControls camera)
   * Shows all camera helpers and resets to default perspective camera
   */
  returnToFreeView(): void {
    logger.info('[Camera Switch] Returning to free view');

    // Show all camera helpers
    this.showAllCameraHelpers();

    // Reset to default camera properties
    this.camera.fov = 75;
    this.camera.near = 0.1;
    this.camera.far = 1000;
    this.camera.updateProjectionMatrix();

    // Don't reset position - keep current view
    logger.info('[Camera Switch] Returned to free view');
  }

  /**
   * Set visibility of all camera helpers
   * Useful for toggling camera frustum visualization on/off
   */
  setCameraHelpersVisible(visible: boolean): void {
    logger.info(`[Camera Helpers] Setting camera helpers visible: ${visible}`);

    for (const path of this.nodeTracker.getAllPaths()) {
      const object = this.nodeTracker.getObject(path);
      if (object && object.userData.nodeType === 'Camera3D') {
        const helper = object.userData.helper as THREE.CameraHelper | undefined;
        if (helper) {
          helper.visible = visible;
        }
      }
    }
  }

  /**
   * Show all camera helpers (make them visible)
   */
  private showAllCameraHelpers(): void {
    for (const path of this.nodeTracker.getAllPaths()) {
      const object = this.nodeTracker.getObject(path);
      if (object && object.userData.nodeType === 'Camera3D') {
        const helper = object.userData.helper as THREE.CameraHelper | undefined;
        if (helper) {
          helper.visible = true;
        }
      }
    }
  }
}
