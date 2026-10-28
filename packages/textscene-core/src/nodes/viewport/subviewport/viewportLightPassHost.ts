/**
 * The host a SubViewport gives its 2D light pass (`lighting2d/lightPassHost.ts`). The pass draws
 * through the viewport's offscreen scene and canvas camera into buffers the size of its target, and
 * the viewport runs it itself, after it frames its camera and before it draws its target.
 */

import type * as THREE from 'three';
import type { CanvasClip, LightPassHost } from '../../../r3f/lighting2d/lightPassHost';
import type { Vector2 } from '../../../godot/math/vector';

/**
 * Godot's `clip_rect`, `Rect2(0, 0, size)` in screen pixels (`renderer_viewport.cpp:390`), seen
 * from the canvas: the part of it the camera frames, and the pixels the camera gives each unit.
 */
function clipOfCamera(camera: THREE.OrthographicCamera, size: Vector2): CanvasClip {
  const width = camera.right - camera.left;
  const height = camera.top - camera.bottom;
  return {
    rect: { x: camera.position.x + camera.left, y: camera.position.y + camera.bottom, w: width, h: height },
    scale: { x: size.x / width, y: size.y / height },
  };
}

/** Whether `clip` still answers for `camera` and `size`, read without allocating. */
function isCurrent(clip: CanvasClip, camera: THREE.OrthographicCamera, size: Vector2): boolean {
  const { rect, scale } = clip;
  return (
    rect.x === camera.position.x + camera.left &&
    rect.y === camera.position.y + camera.bottom &&
    rect.w === camera.right - camera.left &&
    rect.h === camera.top - camera.bottom &&
    scale.x === size.x / rect.w &&
    scale.y === size.y / rect.h
  );
}

/**
 * The host of one SubViewport, stable while its scene and camera are. `resize` follows the target
 * size, so a resize rebuilds no host and so none of the context the pass publishes.
 */
export interface ViewportLightPassHost extends LightPassHost {
  resize(size: Vector2): void;
}

export function createViewportLightPassHost(
  scene: THREE.Scene,
  camera: THREE.OrthographicCamera,
  canvasPath: string,
  initialSize: Vector2
): ViewportLightPassHost {
  let size = initialSize;
  let clip = clipOfCamera(camera, size);
  return {
    canvasPath,
    scene,
    camera,
    run: { current: null },
    resize: (next) => {
      size = next;
    },
    readBufferSize: (out) => out.set(size.x, size.y),
    readClip: () => {
      if (!isCurrent(clip, camera, size)) clip = clipOfCamera(camera, size);
      return clip;
    },
  };
}
