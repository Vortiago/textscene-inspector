/**
 * The world matrix a billboarding StandardMaterial3D surface draws with. Godot writes it in
 * the vertex shader as a new `MODELVIEW_MATRIX` (`scene/resources/material.cpp:1260-1335`),
 * so it replaces the model basis for that surface alone and keeps the model origin.
 */

import * as THREE from 'three';
import { BillboardMode } from '../godot/billboard';
import type { SurfaceBillboard } from '../resources/materials/standardmaterial3d/materialBag';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/** Scratch vectors, overwritten by every call. */
const axisX = new THREE.Vector3();
const axisY = new THREE.Vector3();
const axisZ = new THREE.Vector3();
const cameraX = new THREE.Vector3();
const cameraZ = new THREE.Vector3();
const modelScale = new THREE.Vector3();

/**
 * Write the billboarded world matrix into `target`. The model's per-axis scale survives
 * only under `billboard_keep_scale` (`material.cpp:1274-1281`); Godot's default drops it.
 *
 * @param camera - the main camera's world matrix for ENABLED and FIXED_Y, and the pass
 *   camera's for PARTICLES, which reads `INV_VIEW_MATRIX` rather than `MAIN_CAM_INV_VIEW_MATRIX`
 * @returns false, with `target` untouched, when the mode does not billboard or the
 *   camera leaves FIXED_Y with no horizontal axis
 */
export function billboardWorldMatrix(
  target: THREE.Matrix4,
  model: THREE.Matrix4,
  camera: THREE.Matrix4,
  billboard: SurfaceBillboard
): boolean {
  const { mode } = billboard;
  switch (mode) {
    case BillboardMode.BILLBOARD_ENABLED:
    case BillboardMode.BILLBOARD_PARTICLES:
      camera.extractBasis(axisX, axisY, axisZ);
      if (mode === BillboardMode.BILLBOARD_PARTICLES) {
        axisX.normalize();
        axisY.normalize();
        axisZ.normalize();
      }
      break;
    case BillboardMode.BILLBOARD_FIXED_Y:
      if (!fixedYBasis(camera)) return false;
      break;
    default:
      return false;
  }

  // `length(MODEL_MATRIX[i].xyz)` per axis, the keep-scale factors.
  if (billboard.keepScale) modelScale.setFromMatrixScale(model);
  else modelScale.set(1, 1, 1);
  target.makeBasis(
    axisX.multiplyScalar(modelScale.x),
    axisY.multiplyScalar(modelScale.y),
    axisZ.multiplyScalar(modelScale.z)
  );
  target.copyPosition(model);
  return true;
}

/**
 * `normalize(cross(up, camZ))`, `up`, `normalize(cross(camX, up))` (`material.cpp:1291-1295`).
 * A camera looking along world Y gives a zero cross product, which GLSL cannot
 * normalise, so the surface keeps the model basis there.
 */
function fixedYBasis(camera: THREE.Matrix4): boolean {
  cameraX.setFromMatrixColumn(camera, 0);
  cameraZ.setFromMatrixColumn(camera, 2);
  axisX.crossVectors(WORLD_UP, cameraZ);
  axisZ.crossVectors(cameraX, WORLD_UP);
  if (axisX.lengthSq() === 0 || axisZ.lengthSq() === 0) return false;
  axisX.normalize();
  axisY.copy(WORLD_UP);
  axisZ.normalize();
  return true;
}
