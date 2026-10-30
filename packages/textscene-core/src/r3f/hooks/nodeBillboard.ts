/**
 * The world matrix of a whole-node billboard: Sprite3D, Label3D and the AudioStreamPlayer3D gizmo.
 * Godot's SpriteBase3D and Label3D hand their mode to the material shader that a surface's
 * `billboard_mode` uses too (`sprite_3d.cpp:299`). Here the node's own matrix turns, so a pick, a
 * gizmo and every child read the billboard.
 */

import * as THREE from 'three';
import { BillboardMode } from '../../godot/rendering/materials/billboardMode';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/** Scratch, overwritten by every call: this runs on every rendered frame. */
const model = new THREE.Matrix4();
const axisX = new THREE.Vector3();
const axisY = new THREE.Vector3();
const axisZ = new THREE.Vector3();
const cameraX = new THREE.Vector3();
const cameraZ = new THREE.Vector3();
const modelScale = new THREE.Vector3();

/**
 * Writes `object.matrixWorld` as Godot's billboard shader builds it, from the camera's axes and
 * the node's world origin, and stops three recomputing it. `get_material_for_2d` turns on
 * `FLAG_BILLBOARD_KEEP_SCALE` with either mode (`material.cpp:3056-3058`), so the node keeps its
 * world scale. Any other mode hands the world matrix back to three.
 */
export function applyBillboard(object: THREE.Object3D, camera: THREE.Camera, mode: number | undefined): void {
  const billboards = mode === BillboardMode.BILLBOARD_ENABLED || mode === BillboardMode.BILLBOARD_FIXED_Y;
  object.matrixWorldAutoUpdate = !billboards;
  if (!billboards) return;

  object.updateMatrix();
  if (object.parent) {
    object.parent.updateWorldMatrix(true, false);
    model.multiplyMatrices(object.parent.matrixWorld, object.matrix);
  } else {
    model.copy(object.matrix);
  }
  camera.updateMatrixWorld();

  if (mode === BillboardMode.BILLBOARD_ENABLED) camera.matrixWorld.extractBasis(axisX, axisY, axisZ);
  else if (!fixedYBasis(camera.matrixWorld)) {
    object.matrixWorld.copy(model);
    return;
  }
  modelScale.setFromMatrixScale(model);
  object.matrixWorld.makeBasis(
    axisX.multiplyScalar(modelScale.x),
    axisY.multiplyScalar(modelScale.y),
    axisZ.multiplyScalar(modelScale.z)
  );
  object.matrixWorld.copyPosition(model);
}

/**
 * `normalize(cross(up, camZ))`, `up`, `normalize(cross(camX, up))` (`material.cpp:1291-1295`).
 * A camera looking along world Y gives a zero cross product, which GLSL cannot normalise, so the
 * node keeps its model basis there, as a surface's billboard does (`surfaceBillboard.ts`).
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
