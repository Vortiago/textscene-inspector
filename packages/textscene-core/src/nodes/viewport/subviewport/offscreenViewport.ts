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
import { camera2DView, type Camera2DTag } from '../../2d/camera2d/cameraView';

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
  name: string,
  options: { colorSpace?: THREE.ColorSpace; preTonemapped?: boolean } = {}
): THREE.WebGLRenderTarget {
  const { colorSpace = THREE.LinearSRGBColorSpace, preTonemapped = true } = options;
  const target = new THREE.WebGLRenderTarget(width, height, {
    depthBuffer: true,
    stencilBuffer: false,
    // `samples` stays at three's 0. A 2D pass shares this constructor and must
    // not multisample — scene/main/viewport.h:309, `msaa_2d = MSAA_DISABLED`.
    samples: 0,
  });
  target.texture.colorSpace = colorSpace;
  target.texture.name = `${name}::target`;
  // The sub-viewport's own filter enum is not reproduced; linear matches
  // Godot's default `canvas_item_default_texture_filter` (1, LINEAR).
  target.texture.minFilter = THREE.LinearFilter;
  target.texture.magFilter = THREE.LinearFilter;
  target.texture.generateMipmaps = false;
  if (preTonemapped) {
    // Not declared by @types/three; three itself toggles the flag on plain
    // render targets the same way (`XRManager.js`).
    (target as THREE.WebGLRenderTarget & { isXRRenderTarget: boolean }).isXRRenderTarget = true;
  }
  return target;
}

/**
 * Reused across every offscreen pass so the renderer state each one mutates is
 * captured and restored in one place, and so no pass allocates a `THREE.Color`
 * per frame merely to hold the previous clear colour.
 *
 * Safe as a module-level scratch because passes are driven SEQUENTIALLY by the
 * one orchestrator (`ViewportPassRegistryContext`), never nested inside one
 * another — a nested pass would clobber the outer pass's saved colour.
 */
const PREVIOUS_CLEAR_COLOR = new THREE.Color();

/**
 * Bind `target`, clear it, run `draw`, and restore every piece of renderer
 * state the pass touched — render target, clear colour + alpha, tone mapping.
 *
 * `toneMapping` suspends the renderer's curve for the pass when given (a 2D
 * canvas, an own-world 3D viewport, or a Control subtree is never tonemapped);
 * omit it to render under whatever curve is in force. `beforeBind` runs inside
 * the guarded region but BEFORE the target is bound, for state that must be
 * asserted with no offscreen render in flight under it.
 *
 * State a single caller owns (the 3D pass's perspective-aspect swap) stays at
 * that call site, wrapped around this helper rather than folded into it.
 */
export function renderToOffscreenTarget(
  gl: THREE.WebGLRenderer,
  options: {
    target: THREE.WebGLRenderTarget;
    transparentBg: boolean;
    toneMapping?: THREE.ToneMapping;
    beforeBind?: () => void;
    draw: () => void;
  }
): void {
  const previousTarget = gl.getRenderTarget();
  const previousAlpha = gl.getClearAlpha();
  const previousToneMapping = gl.toneMapping;
  gl.getClearColor(PREVIOUS_CLEAR_COLOR);

  try {
    if (options.toneMapping !== undefined) gl.toneMapping = options.toneMapping;
    options.beforeBind?.();
    gl.setRenderTarget(options.target);
    gl.setClearColor(DEFAULT_CLEAR_COLOR, options.transparentBg ? 0 : 1);
    gl.clear(true, true, true);
    options.draw();
  } finally {
    gl.setRenderTarget(previousTarget);
    gl.setClearColor(PREVIOUS_CLEAR_COLOR, previousAlpha);
    gl.toneMapping = previousToneMapping;
  }
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
 * The Camera2D a sub-viewport's canvas renders through, or null when it has
 * none — the FIRST enabled one in tree order.
 *
 * This is the exact inverse of the 3D rule above, and the asymmetry is in the
 * engine, not here. `scene/2d/camera_2d.cpp`, `NOTIFICATION_ENTER_TREE`:
 *
 *     if (!_is_editing_in_editor() && enabled && !viewport->get_camera_2d()) {
 *         make_current();
 *     }
 *
 * The `!viewport->get_camera_2d()` guard is the whole difference: a Camera2D
 * claims the viewport only while it is still VACANT, so a later camera cannot
 * displace an incumbent — first enabled in tree order wins. `Camera3D` has no
 * such guard (`_camera_3d_set` replaces unconditionally), so there the LAST
 * current camera wins. `set_enabled` repeats the same guarded claim, so a
 * disabled camera never becomes current and never blocks a later one.
 *
 * `_is_editing_in_editor()` is deliberately NOT modelled: in the editor Godot
 * skips the claim entirely and the canvas keeps its identity transform. The
 * previewer previews the scene as it RUNS — which is also what `pnpm ref:godot`
 * captures — so the runtime branch is the one worth matching.
 *
 * Scope needs no path filter, unlike the 3D selector: a 2D sub-viewport's
 * subtree is always portalled into its own detached scene (`rendersInline`
 * requires 3D content), and a nested sub-viewport portals its children onward,
 * so `root` already contains exactly this viewport's cameras.
 */
export function selectViewportCamera2D(root: THREE.Object3D): THREE.Object3D | null {
  let chosen: THREE.Object3D | null = null;

  // Depth-first pre-order, which is the order nodes enter the tree.
  root.traverse((object) => {
    if (chosen) return;
    const tag = object.userData?.camera2d as Camera2DTag | undefined;
    if (!tag || tag.enabled === false) return;
    chosen = object;
  });

  return chosen;
}

/**
 * An Object3D's position in Godot canvas pixels.
 *
 * `node2dTransform` conjugates every 2D local transform by `diag(1, -1, 1)`, so
 * a node authored at Godot `(100, 50)` sits at three `(100, -50)` and the trip
 * back is one negation. Reading the world matrix rather than walking the parsed
 * tree is what makes a Camera2D inside an instanced sub-scene resolve for free.
 */
export function godotCanvasPosition(object: THREE.Object3D): { x: number; y: number } {
  const world = object.getWorldPosition(new THREE.Vector3());
  return { x: world.x, y: -world.y };
}

/**
 * Frame the target rect through a Camera2D — `orthoFrameForSize` generalised
 * from "the whole rect at the origin" to "the camera's view".
 *
 * The view rect itself (anchor mode, the scroll-limit clamp, `offset` applied
 * after that clamp) is `camera2DView`, shared with the Cameras panel rather
 * than re-derived. Only the projection is new: a view is `size / zoom` pixels
 * wide, centred on the view centre, with z unchanged at 1000 so nothing about
 * draw order shifts.
 */
export function orthoFrameForCamera2D(
  framing: Camera2DTag,
  worldPosition: { x: number; y: number },
  size: Vector2
): OrthoFrame {
  const width = size.x > 0 ? size.x : 1;
  const height = size.y > 0 ? size.y : 1;
  const view = camera2DView(framing, worldPosition, { x: width, y: height });
  // The framed extent the view already computed, per axis. Re-deriving it from
  // one magnification dropped the Y zoom.
  const halfWidth = view.size.x / 2;
  const halfHeight = view.size.y / 2;
  return {
    left: -halfWidth,
    right: halfWidth,
    top: halfHeight,
    bottom: -halfHeight,
    position: [view.center.x, -view.center.y, 1000],
  };
}

/**
 * Apply a frame to the persistent 2D camera, rebuilding the projection matrix
 * only when the frustum actually moved — the pass recomputes the frame every
 * rendered frame, but a static scene's camera never changes.
 */
export function applyOrthoFrame(camera: THREE.OrthographicCamera, frame: OrthoFrame): void {
  const moved =
    camera.left !== frame.left ||
    camera.right !== frame.right ||
    camera.top !== frame.top ||
    camera.bottom !== frame.bottom;

  camera.left = frame.left;
  camera.right = frame.right;
  camera.top = frame.top;
  camera.bottom = frame.bottom;
  camera.position.set(...frame.position);
  if (moved) camera.updateProjectionMatrix();
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
