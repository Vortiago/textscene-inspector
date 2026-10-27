/**
 * The rules behind a sub-viewport's offscreen pass: the render target, the pass
 * that renders into it, camera choice and target framing, free of R3F so each is
 * asserted directly. `Component.tsx` wires them into a mounted tree.
 */

import * as THREE from 'three';
import { camera2DView, type Camera2DTag } from '../../2d/camera2d/cameraView';
import { electViewportCamera } from '../../../godot/scene/camera3d';
import { takeOutputLikeDrawingBuffer } from '../../../r3f/outputTarget';
import { markSrgbBytes } from '../../../r3f/srgbByteTextures';
import { pinColorSpace } from '../../../resources/textures/applyTextureState';
import type { SubViewportProperties } from './types';
import type { Vector2 } from '../../../godot/math/vector';

/**
 * The target of a pass that draws the 3D world. Godot tonemaps each viewport into its own target as
 * sRGB-encoded 8-bit texels (`tonemap.glsl` `linear_to_srgb`), so the storage is SRGB8_ALPHA8, which
 * encodes on write and decodes on sample in hardware. The LINEAR tag keeps the shader from encoding
 * too: an sRGB tag would stack a shader encode on the hardware encode.
 */
export function createSceneTarget(width: number, height: number, name: string): THREE.WebGLRenderTarget {
  const target = createTarget(width, height, name);
  target.depthBuffer = true;
  // Pinned: R3F stamps `SRGBColorSpace` on a target bound to an albedo `map`, and three reads
  // this pass's output space from the tag, so the stamp would add an sRGB OETF (1.5-6.5x too bright).
  pinColorSpace(target.texture, THREE.LinearSRGBColorSpace);
  target.texture.internalFormat = 'SRGB8_ALPHA8';
  return target;
}

/**
 * The target of a pass that draws canvas items, the 2D world's or the Controls'. Godot's canvas
 * draws after the tonemap pass (`RendererViewport::_draw_viewport`) and writes its sRGB numbers
 * straight into an `R8G8B8A8_UNORM` target (`renderer_canvas_render_rd.cpp:671,729`,
 * `texture_storage.cpp:3568-3569`). So three encodes into RGBA8, as into the drawing buffer, and
 * blends and filters the encoded bytes. An sRGB tag alone would allocate SRGB8_ALPHA8. It holds no
 * depth: a 2D pass draws into a `CanvasFrame`, which does.
 */
export function createCanvasTarget(width: number, height: number, name: string): THREE.WebGLRenderTarget {
  const target = createTarget(width, height, name);
  storeSrgbBytes(target.texture);
  return target;
}

/** Makes `texture` the storage of canvas bytes: RGBA8 under a pinned sRGB tag, marked as bytes. */
export function storeSrgbBytes(texture: THREE.Texture): void {
  pinColorSpace(texture, THREE.SRGBColorSpace);
  texture.internalFormat = 'RGBA8';
  // An explicit mark, not a rule on RGBA8 under an sRGB tag: CanvasFrame has that shape too.
  markSrgbBytes(texture);
}

/**
 * A target that takes its pass's output as the drawing buffer does, with Godot's sampler: linear,
 * and one mip level (`texture_storage.cpp:3585`), so minification and magnification follow one
 * rule. Not the SubViewport's `canvas_item_default_texture_filter`: Godot passes that to the items
 * drawn into the viewport (`renderer_viewport.cpp:688`), not to sampling its texture.
 */
function createTarget(width: number, height: number, name: string): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: false, stencilBuffer: false });
  target.texture.name = `${name}::target`;
  target.texture.minFilter = THREE.LinearFilter;
  target.texture.magFilter = THREE.LinearFilter;
  target.texture.generateMipmaps = false;
  takeOutputLikeDrawingBuffer(target);
  return target;
}

/**
 * The MSAA mode a sub-viewport's pass takes: `msaa_3d` for the 3D world it draws, `msaa_2d` for its
 * canvas items. Godot keeps one mode per buffer (`renderer_viewport.cpp:1354-1370`).
 */
export function viewportMsaaMode(
  modes: Pick<SubViewportProperties, 'msaa_2d' | 'msaa_3d'>,
  kind: '2d' | '3d'
): number {
  return kind === '3d' ? modes.msaa_3d : modes.msaa_2d;
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
 * pass.
 */
export function renderToOffscreenTarget(
  gl: THREE.WebGLRenderer,
  options: {
    target: THREE.WebGLRenderTarget;
    /** The project clear colour, linear, which an opaque target clears to (`renderer_viewport.cpp:371`). */
    clearColor: THREE.Color;
    transparentBg: boolean;
    toneMapping?: THREE.ToneMapping;
    draw: () => void;
  }
): void {
  const previousTarget = gl.getRenderTarget();
  const previousAlpha = gl.getClearAlpha();
  const previousToneMapping = gl.toneMapping;
  gl.getClearColor(PREVIOUS_CLEAR_COLOR);

  try {
    if (options.toneMapping !== undefined) gl.toneMapping = options.toneMapping;
    gl.setRenderTarget(options.target);
    gl.setClearColor(options.clearColor, options.transparentBg ? 0 : 1);
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
 * shared-world source holds every viewport's cameras.
 */
export function selectViewportCamera(root: THREE.Object3D, viewportPath: string): THREE.Camera | null {
  const prefix = `${viewportPath}/`;
  const cameras: THREE.Camera[] = [];

  // Depth-first pre-order, which is the order nodes enter the tree.
  root.traverse((object) => {
    if (!(object as THREE.Camera).isCamera) return;
    const path = object.userData?.tscnPath;
    if (typeof path === 'string' && path.startsWith(prefix)) cameras.push(object as THREE.Camera);
  });

  return electViewportCamera(cameras, (camera) => camera.userData?.tscnCurrent === true);
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
 * The projection aspect for a target of `size` pixels, which the offscreen pass fits its
 * `<Camera3D>` to for its render.
 */
export function viewportAspect(size: Vector2): number {
  if (!(size.x > 0) || !(size.y > 0)) return 1;
  return size.x / size.y;
}

/** An orthographic frustum and camera position framing exactly `size` pixels. */
interface OrthoFrame {
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
