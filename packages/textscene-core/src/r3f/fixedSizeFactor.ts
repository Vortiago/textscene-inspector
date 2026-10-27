/**
 * The factor of Godot's `FLAG_FIXED_SIZE` (`scene/resources/material.cpp:1357-1381`), which scales
 * a quad's model-view basis so it keeps one on-screen size at any distance. `IS_MULTIVIEW` (stereo)
 * has no counterpart, since this renderer has one camera.
 */

import * as THREE from 'three';

/** Scratch, overwritten by every call: this runs on every rendered frame. */
const viewSpaceOrigin = new THREE.Vector3();

/**
 * The scale a fixed-size quad at `worldOrigin` takes. It reads `camera.matrixWorldInverse`, which
 * `camera.updateMatrixWorld()` brings up to date.
 *
 * @canonical Godot's fixed-size scale factor for a quad at a world origin
 */
export function fixedSizeFactor(camera: THREE.Camera, worldOrigin: THREE.Vector3): number {
  const projection = camera.projectionMatrix.elements;
  // Branch on `PROJECTION_MATRIX[3][3]` as the emitted GLSL does, not on the camera's class.
  if (projection[15] !== 0) {
    // Orthogonal: `h = abs(1 / (2 * PROJECTION_MATRIX[1][1]))`, `sc = h * 2`, with no depth term.
    return Math.abs(1 / projection[5]!);
  }
  // Perspective: `sc = -(MODELVIEW_MATRIX)[3].z`, the origin's view-space depth.
  viewSpaceOrigin.copy(worldOrigin).applyMatrix4(camera.matrixWorldInverse);
  return -viewSpaceOrigin.z;
}
