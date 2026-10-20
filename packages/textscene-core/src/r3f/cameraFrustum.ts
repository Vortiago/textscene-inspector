/** The frustum a render through a camera sees, for a pass that runs inside that render. */

import * as THREE from 'three';

/** Scratch for one call: the product is read only inside it. */
const viewProjection = new THREE.Matrix4();

/**
 * Writes `camera`'s frustum into `target` and returns it. three updates the camera's matrices
 * before `onBeforeRender` (r186 `WebGLRenderer.js:1663-1678`), so a render hook reads them current.
 */
export function cameraFrustum(camera: THREE.Camera, target: THREE.Frustum): THREE.Frustum {
  viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  return target.setFromProjectionMatrix(viewProjection, camera.coordinateSystem, camera.reversedDepth);
}
