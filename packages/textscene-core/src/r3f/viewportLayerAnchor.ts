/**
 * Where a CanvasLayer sits in a sub-viewport pass that draws through a Camera2D's view. Godot draws
 * a layer's canvas through the layer's own transform, and a following layer's through the view too,
 * scaled about the viewport's centre (`renderer_viewport.cpp:46-86`).
 */

import * as THREE from 'three';
import { orthoViewRect } from './viewportRender/viewportFraming.js';
import type { Rect2 } from '../godot/math/rect2.js';
import type { WorldRender } from './viewportRender/worldRender.js';

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

/** A layer sits on the view's top-left, or takes the view scaled about its centre where it follows. */
function viewportLayerMatrix(
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

/** The layer's matrix in `render`: anchored in a SubViewport's 2D pass, else the identity. */
export function canvasLayerAnchor(
  follow: ViewportLayerFollow,
  camera: THREE.Camera,
  render: WorldRender | null,
  target: THREE.Matrix4
): THREE.Matrix4 {
  const canvasView = render?.canvasView;
  if (!canvasView || !(camera instanceof THREE.OrthographicCamera)) return target.identity();
  return viewportLayerMatrix(follow, camera, canvasView, target);
}

/** Puts a layout of the canvas size on the view's top-left corner, unit for unit, turned with the view. */
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
