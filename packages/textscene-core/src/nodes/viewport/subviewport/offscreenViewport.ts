/**
 * The rules behind a sub-viewport's offscreen pass: the render target, the pass
 * that renders into it, camera choice and target framing, free of R3F so each is
 * asserted directly. `Component.tsx` wires them into a mounted tree.
 */

import * as THREE from 'three';
import type { Vector2 } from '../../base/node2d/types';
import { camera2DView, type Camera2DTag } from '../../2d/camera2d/cameraView';

/**
 * Godot's `rendering/environment/defaults/default_clear_color`, `Color(0.3, 0.3, 0.3)`,
 * which a non-`transparent_bg` target clears to. The 0.3 is sRGB: Godot measures
 * rgb(77, 77, 77). `new THREE.Color(0.3, 0.3, 0.3)` sets linear 0.3, about rgb(149).
 */
export const DEFAULT_CLEAR_COLOR = new THREE.Color().setRGB(
  0.3,
  0.3,
  0.3,
  THREE.SRGBColorSpace
);

/**
 * The offscreen pass's render target, carrying the storage and the tonemap
 * contracts. Godot tonemaps every viewport render into its own target
 * (`_render_buffers_post_process_and_tonemap`), so a target holds post-tonemap
 * values. The default LINEAR tag writes and samples them with no encode or decode.
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
    // not multisample: scene/main/viewport.h:309, `msaa_2d = MSAA_DISABLED`.
    samples: 0,
  });
  // An sRGB tag would stack a shader encode on three's SRGB8 hardware encode
  // and darken every sample.
  target.texture.colorSpace = colorSpace;
  target.texture.name = `${name}::target`;
  // The sub-viewport's own filter enum is not reproduced. Linear matches
  // Godot's default `canvas_item_default_texture_filter` (1, LINEAR).
  target.texture.minFilter = THREE.LinearFilter;
  target.texture.magFilter = THREE.LinearFilter;
  target.texture.generateMipmaps = false;
  if (preTonemapped) {
    // `WebGLPrograms.js` tonemaps a target only when `isXRRenderTarget`, and then
    // takes the output space from `texture.colorSpace`. Without it the target
    // missed a curve (0.60-0.65x under FILMIC). Not declared by @types/three:
    // three sets it on plain render targets the same way (`XRManager.js`).
    (target as THREE.WebGLRenderTarget & { isXRRenderTarget: boolean }).isXRRenderTarget = true;
  }
  return target;
}

/**
 * The previous clear colour, reused so no pass allocates a `THREE.Color` per frame.
 * Written only by `renderToOffscreenTarget`. Safe as a module scratch because the
 * one orchestrator (`ViewportPassRegistryContext`) drives passes in sequence,
 * never nested, so no pass clobbers another's saved colour.
 */
const PREVIOUS_CLEAR_COLOR = new THREE.Color();

/**
 * Bind `target`, clear it, run `draw`, and restore the render target, clear colour,
 * alpha and tone mapping. A given `toneMapping` replaces the renderer's curve for the
 * pass. `beforeBind` runs inside the guarded region, before the bind, for state
 * that no offscreen render may run under.
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
 * The camera a sub-viewport renders through, or null when it has none. Only a
 * descendant counts: a `Camera3D` joins `get_viewport()` on ENTER_WORLD, and a
 * shared-world source holds every viewport's cameras. `scene/3d/camera_3d.cpp`'s
 * `_camera_3d_set` overwrites, so the last `current` wins, or else the first.
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
 * The first enabled Camera2D in tree order, or null. `scene/2d/camera_2d.cpp` claims
 * the viewport only while `!viewport->get_camera_2d()`, the inverse of the 3D rule.
 * The editor-only branch is not modelled: the previewer shows the running scene.
 * No path filter: a 2D subtree is always portalled, so `root` holds only its cameras.
 */
export function selectViewportCamera2D(root: THREE.Object3D): THREE.Object3D | null {
  let chosen: THREE.Object3D | null = null;

  // Depth-first pre-order, which is the order nodes enter the tree.
  root.traverse((object) => {
    if (chosen) return;
    const tag = object.userData?.camera2d as Camera2DTag | undefined;
    // `set_enabled` makes the same guarded claim, so a disabled camera never
    // becomes current and never blocks a later one.
    if (!tag || tag.enabled === false) return;
    chosen = object;
  });

  return chosen;
}

/**
 * An Object3D's position in Godot canvas pixels: `node2dTransform` negates Y, so
 * the trip back is one negation. The world matrix, not the parsed tree, also
 * composes an instanced sub-scene's ancestors.
 */
export function godotCanvasPosition(object: THREE.Object3D): { x: number; y: number } {
  const world = object.getWorldPosition(new THREE.Vector3());
  return { x: world.x, y: -world.y };
}

/**
 * Frame the target rect through a Camera2D. `camera2DView`, shared with the Cameras
 * panel, computes the view rect. The projection is `size / zoom` pixels wide,
 * centred on the view, at z 1000 so draw order does not shift.
 */
export function orthoFrameForCamera2D(
  framing: Camera2DTag,
  worldPosition: { x: number; y: number },
  size: Vector2
): OrthoFrame {
  const width = size.x > 0 ? size.x : 1;
  const height = size.y > 0 ? size.y : 1;
  const view = camera2DView(framing, worldPosition, { x: width, y: height });
  // The framed extent the view already computed, per axis, so the Y zoom
  // applies too.
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
 * only when the frustum moved: the pass recomputes the frame every rendered
 * frame, but a static scene's camera never changes.
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
 * The projection aspect for a target of `size` pixels. `<Camera3D>` builds every
 * camera at the canvas's 16:9, so the offscreen pass overrides it for its render.
 */
export function viewportAspect(size: Vector2): number {
  if (!(size.x > 0) || !(size.y > 0)) return 1;
  return size.x / size.y;
}

/** An orthographic frustum and camera position framing exactly `size` pixels. */
export interface OrthoFrame {
  left: number;
  right: number;
  top: number;
  bottom: number;
  position: [number, number, number];
}

/**
 * Frame the target rect for CanvasItem content. Godot lays such content out in
 * target pixels from a top-left origin with +Y down. The previewer negates Y
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
