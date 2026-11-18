/**
 * Where a CanvasLayer sits in a sub-viewport pass that draws through a Camera2D's view. Godot draws
 * a layer's canvas through the layer's own transform, and a following layer's through the view too,
 * scaled about the viewport's centre (`renderer_viewport.cpp:46-86`).
 */

import * as THREE from 'three';
import { orthoViewRect } from './viewportRender/viewportFraming.js';
import type { Rect2 } from '../godot/math/rect2.js';

/** Written only by {@link viewAnchorMatrix}, which reads them before returning. */
const view: Rect2 = { x: 0, y: 0, w: 0, h: 0 };
const turn = new THREE.Matrix4();
const shift = new THREE.Matrix4();

/** How a CanvasLayer follows the viewport's canvas transform. */
export interface ViewportLayerFollow {
  /** `follow_viewport_enabled`. */
  readonly enabled: boolean;
  /** `follow_viewport_scale`. */
  readonly scale: number;
}

/**
 * Writes into `target` the matrix a layer's canvas draws through in the pass, before its own
 * transform. A layer that does not follow keeps its origin at the view's top-left and one viewport
 * pixel per pixel. A following layer takes the view as world content does, scaled about its centre.
 */
export function viewportLayerMatrix(
  follow: ViewportLayerFollow,
  camera: THREE.OrthographicCamera,
  size: { x: number; y: number },
  target: THREE.Matrix4
): THREE.Matrix4 {
  const { x, y } = camera.position;
  if (follow.enabled) {
    const s = follow.scale;
    return target.makeScale(s, s, 1).setPosition(x * (1 - s), y * (1 - s), 0);
  }
  return viewAnchorMatrix(camera, size, target);
}

/** Puts a viewport-sized layout on the view's top-left corner, one pixel per pixel, turned with the view. */
export function viewAnchorMatrix(
  camera: THREE.OrthographicCamera,
  size: { x: number; y: number },
  target: THREE.Matrix4
): THREE.Matrix4 {
  const { w, h } = orthoViewRect(camera, view);
  const corner = target.makeScale(w / size.x, h / size.y, 1).setPosition(camera.left, camera.top, 0);
  return corner
    .premultiply(turn.makeRotationZ(camera.rotation.z))
    .premultiply(shift.makeTranslation(camera.position.x, camera.position.y, 0));
}
