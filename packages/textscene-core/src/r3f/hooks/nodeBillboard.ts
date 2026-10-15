/**
 * The world matrix of a whole-node billboard: Sprite3D, Label3D and the AudioStreamPlayer3D gizmo.
 * It draws through `billboardWorldMatrix`, as Godot's SpriteBase3D and Label3D hand their mode to
 * the material shader that a surface's `billboard_mode` uses too (`sprite_3d.cpp:299`).
 */

import * as THREE from 'three';
import { BillboardMode } from '../../godot/scene/billboard';
import { billboardWorldMatrix } from '../surfaceBillboard';

/** Scratch, overwritten by every call: this runs on every rendered frame. */
const model = new THREE.Matrix4();
const ENABLED = { mode: BillboardMode.BILLBOARD_ENABLED, keepScale: true } as const;
const FIXED_Y = { mode: BillboardMode.BILLBOARD_FIXED_Y, keepScale: true } as const;

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

  const options = mode === BillboardMode.BILLBOARD_ENABLED ? ENABLED : FIXED_Y;
  if (!billboardWorldMatrix(object.matrixWorld, model, camera.matrixWorld, options)) {
    object.matrixWorld.copy(model);
  }
}
