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
  const scaleX = (camera.right - camera.left) / size.x;
  const scaleY = (camera.top - camera.bottom) / size.y;
  return target.makeScale(scaleX, scaleY, 1).setPosition(x + camera.left, y + camera.top, 0);
}
