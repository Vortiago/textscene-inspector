/**
 * The pure rules behind a sub-viewport's offscreen pass — camera choice, target
 * framing, and the pixel readback — with no R3F and no renderer, so each is
 * asserted directly instead of being inferred from a rendered frame.
 *
 * The rendering half lives in `Component.tsx`; everything decidable without a
 * GL context lives here.
 */

import * as THREE from 'three';
import type { Vector2 } from '../../base/node2d/types';

/**
 * Godot's `rendering/environment/defaults/default_clear_color`, `Color(0.3,
 * 0.3, 0.3)` — what a non-`transparent_bg` target clears to.
 *
 * The 0.3 is an **sRGB** component: a Godot 4.6.3 render of an opaque target
 * the content does not cover measures rgb(77, 77, 77), and 0.3 × 255 ≈ 77.
 * `new THREE.Color(0.3, 0.3, 0.3)` would instead set 0.3 in the *working*
 * (linear) space and clear to about rgb(149).
 */
export const DEFAULT_CLEAR_COLOR = new THREE.Color().setRGB(
  0.3,
  0.3,
  0.3,
  THREE.SRGBColorSpace
);

/**
 * The offscreen pass's render target — the storage contract AND the tonemap
 * contract, which turn out to be two halves of one decision in three.
 *
 * Godot tonemaps every viewport render, a sub-viewport's included: the RD
 * renderer's `_render_buffers_post_process_and_tonemap` reads the viewport's
 * environment (`environment_get_tone_mapper`) and runs the curve into the
 * viewport's own target, so a shared-world target stores POST-tonemap values
 * and the main viewport applies the curve again to the consuming surface.
 * three refuses that first application for an ordinary target:
 * `WebGLPrograms.js` grants `toneMapping = renderer.toneMapping` only when
 * `currentRenderTarget === null || currentRenderTarget.isXRRenderTarget ===
 * true`. Without the flag the target held PRE-tonemap light and everything
 * sampled through it missed one application of the environment's curve — a
 * measured 0.60–0.65x linear gap under the ADR-0025 preview environment's
 * FILMIC, while the same content matched Godot exactly in the direct view.
 * Setting `isXRRenderTarget` makes the offscreen pass tonemap with the
 * renderer's live curve exactly as the main pass does.
 *
 * The same three decision takes the pass's output space from
 * `texture.colorSpace` once the flag is set, so LINEAR is load-bearing twice:
 * the pass writes working-space values with no encode, and a consuming
 * material samples them back with no decode — the identity round trip. An
 * sRGB tag would stack a shader-side encode on the SRGB8 hardware encode
 * three allocates for sRGB target textures and darken every sample.
 */
export function createOffscreenTarget(
  width: number,
  height: number,
  name: string
): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, {
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.LinearSRGBColorSpace;
  target.texture.name = `${name}::target`;
  // The sub-viewport's own filter enum is not reproduced; linear matches
  // Godot's default `canvas_item_default_texture_filter` (1, LINEAR).
  target.texture.minFilter = THREE.LinearFilter;
  target.texture.magFilter = THREE.LinearFilter;
  target.texture.generateMipmaps = false;
  // Not declared by @types/three; three itself toggles the flag on plain
  // render targets the same way (`XRManager.js`).
  (target as THREE.WebGLRenderTarget & { isXRRenderTarget: boolean }).isXRRenderTarget = true;
  return target;
}

/**
 * The camera a sub-viewport renders through, or null when it has none.
 *
 * Godot binds a camera to the nearest Viewport ancestor: on
 * `NOTIFICATION_ENTER_WORLD` a `Camera3D` calls `viewport->_camera_3d_add(this)`
 * against `get_viewport()`, so only a camera DESCENDED from this sub-viewport
 * counts. That scoping is load-bearing rather than tidy: with a shared
 * `World3D` the render source is the whole main scene, so every other
 * viewport's camera is in `root` too.
 *
 * The selection rule is one line of `scene/3d/camera_3d.cpp`
 * (`Camera3D::_notification`, `NOTIFICATION_ENTER_WORLD`):
 *
 *     if (current || first_camera) { viewport->_camera_3d_set(this); }
 *
 * where `first_camera` is `_camera_3d_add` returning "the set had size 1".
 * `_camera_3d_set` replaces the incumbent unconditionally, so with several
 * cameras marked `current` the **last one in tree order wins**, not the first;
 * with none marked, the first to enter — i.e. first in tree order — wins.
 * `<Camera3D>` tags each camera it creates with both facts.
 */
export function selectViewportCamera(
  root: THREE.Object3D,
  viewportPath: string
): THREE.Camera | null {
  const prefix = `${viewportPath}/`;
  let first: THREE.Camera | null = null;
  let lastCurrent: THREE.Camera | null = null;

  // Depth-first pre-order, which is the order nodes enter the tree.
  root.traverse((object) => {
    if (!(object as THREE.Camera).isCamera) return;
    const path = object.userData?.tscnPath;
    if (typeof path !== 'string' || !path.startsWith(prefix)) return;
    if (object.userData?.tscnCurrent === true) {
      lastCurrent = object as THREE.Camera;
      return;
    }
    first ??= object as THREE.Camera;
  });

  return lastCurrent ?? first;
}

/**
 * The projection aspect for a target of `size` pixels. A sub-viewport's camera
 * frames the TARGET rect, never the on-screen canvas — `<Camera3D>` builds
 * every camera at the canvas's 16:9 default, so the offscreen pass has to
 * override this for the duration of its render.
 */
export function viewportAspect(size: Vector2): number {
  if (!(size.x > 0) || !(size.y > 0)) return 1;
  return size.x / size.y;
}

/** An orthographic frustum + camera position framing exactly `size` pixels. */
export interface OrthoFrame {
  left: number;
  right: number;
  top: number;
  bottom: number;
  position: [number, number, number];
}

/**
 * Frame the target rect for CanvasItem content. Godot lays such content out in
 * target pixels from a top-left origin with +Y down; the previewer negates Y
 * (`node2dTransform`), so the rect occupies x ∈ [0, w], y ∈ [-h, 0] and the
 * camera centres on (w/2, -h/2). The z of 1000 mirrors the 2D world canvas.
 */
export function orthoFrameForSize(size: Vector2): OrthoFrame {
  const width = size.x > 0 ? size.x : 1;
  const height = size.y > 0 ? size.y : 1;
  return {
    left: -width / 2,
    right: width / 2,
    top: height / 2,
    bottom: -height / 2,
    position: [width / 2, -height / 2, 1000],
  };
}

/**
 * Turn a `readRenderTargetPixels` buffer into `ImageData`.
 *
 * GL hands rows back bottom-up (its framebuffer origin is bottom-left) while
 * `ImageData` is top-down, so the rows are reversed here. Nothing else in the
 * repo would catch that: the only fixture a DOM consumer is measured against is
 * vertically symmetric, so a flipped target is pixel-identical.
 *
 * Returns null — never a blank image — when the buffer does not describe the
 * stated rect or `ImageData` is unavailable (the linter bundle and any non-DOM
 * host), because callers must be able to tell "not ready" from "empty".
 */
export function targetPixelsToImageData(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): ImageData | null {
  if (width <= 0 || height <= 0) return null;
  const stride = width * 4;
  if (pixels.length !== stride * height) return null;
  if (typeof ImageData === 'undefined') return null;

  const flipped = new Uint8ClampedArray(pixels.length);
  for (let row = 0; row < height; row++) {
    const source = (height - 1 - row) * stride;
    flipped.set(pixels.subarray(source, source + stride), row * stride);
  }
  return new ImageData(flipped, width, height);
}
