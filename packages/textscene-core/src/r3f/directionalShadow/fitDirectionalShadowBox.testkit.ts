/** The camera slice a fitted box must cover, worked out apart from the fitter's own corners. */

import * as THREE from 'three';

const NDC_CORNERS = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
] as const;

/**
 * The eight world-space corners of the camera's view between two depths along -Z
 * (`Projection::get_endpoints`, called at `renderer_scene_cull.cpp:2206`), near then far per ray.
 */
export function cameraSliceCorners(
  camera: THREE.Camera,
  nearDepth: number,
  farDepth: number
): THREE.Vector3[] {
  return NDC_CORNERS.flatMap(([x, y]) => {
    const onNear = new THREE.Vector3(x, y, -1).applyMatrix4(camera.projectionMatrixInverse);
    const onFar = new THREE.Vector3(x, y, 1).applyMatrix4(camera.projectionMatrixInverse);
    return [nearDepth, farDepth].map((depth) => {
      const along = (-depth - onNear.z) / (onFar.z - onNear.z);
      return onNear.clone().lerp(onFar, along).applyMatrix4(camera.matrixWorld);
    });
  });
}
