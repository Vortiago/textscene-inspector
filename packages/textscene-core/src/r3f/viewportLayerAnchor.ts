/**
 * Where a CanvasLayer sits in a sub-viewport pass that draws through a Camera2D's view. Godot draws
 * a layer's canvas through the layer's own transform, and a following layer's through the view too,
 * scaled about the viewport's centre (`renderer_viewport.cpp:46-86`).
 */

import * as THREE from 'three';

/** How a CanvasLayer follows the viewport's canvas transform. */
export interface ViewportLayerFollow {
  /** `follow_viewport_enabled`. */
  readonly enabled: boolean;
  /** `follow_viewport_scale`. */
  readonly scale: number;
}

/**
 * Writes into `target` the matrix from layer pixels to the world `camera` frames over `size` pixels:
 * a layer that does not follow keeps its origin at the view's top-left and one viewport pixel per pixel.
 */
export function viewportLayerAnchor(
  camera: THREE.OrthographicCamera,
  size: { x: number; y: number },
  target: THREE.Matrix4
): THREE.Matrix4 {
  const scaleX = (camera.right - camera.left) / size.x;
  const scaleY = (camera.top - camera.bottom) / size.y;
  return target.set(
    scaleX,
    0,
    0,
    camera.position.x + camera.left,
    0,
    scaleY,
    0,
    camera.position.y + camera.top,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1
  );
}

/**
 * Writes into `target` the matrix a layer's canvas draws through in the pass, before its own
 * transform. A following layer takes the view as world content does, scaled about the view's centre.
 */
export function viewportLayerMatrix(
  follow: ViewportLayerFollow,
  camera: THREE.OrthographicCamera,
  size: { x: number; y: number },
  target: THREE.Matrix4
): THREE.Matrix4 {
  if (!follow.enabled) return viewportLayerAnchor(camera, size, target);
  const { x, y } = camera.position;
  return target
    .makeTranslation(x, y, 0)
    .multiply(new THREE.Matrix4().makeScale(follow.scale, follow.scale, 1))
    .multiply(new THREE.Matrix4().makeTranslation(-x, -y, 0));
}
