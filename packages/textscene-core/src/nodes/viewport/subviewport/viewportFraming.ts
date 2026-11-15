/**
 * How a sub-viewport's offscreen pass frames its target: the camera it draws through and the
 * orthographic frame of its canvas, free of R3F so each is asserted directly.
 */

import * as THREE from 'three';
import { camera2DView, type Camera2DTag } from '../../2d/camera2d/cameraView';
import type { Vector2 } from '../../../godot/math/vector';
import type { Rect2 } from '../../../godot/math/rect2';

/**
 * The scene's camera at `cameraPath`, or null before it mounts. The world elects the camera
 * (`electCameraOfViewport`) from what the cameras publish, so the pass draws through the one whose
 * attributes it draws at.
 */
export function cameraAtPath(root: THREE.Object3D, cameraPath: string | null): THREE.Camera | null {
  if (cameraPath === null) return null;
  let found: THREE.Camera | null = null;
  root.traverse((object) => {
    if (!found && (object as THREE.Camera).isCamera && object.userData?.tscnPath === cameraPath) {
      found = object as THREE.Camera;
    }
  });
  return found;
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
 * The world rect `camera` frames, written into `out`: a per-frame reader allocates nothing. `y` is
 * the bottom edge, since the previewer's world is +Y up.
 */
export function orthoViewRect(camera: THREE.OrthographicCamera, out: Rect2): Rect2 {
  out.x = camera.position.x + camera.left;
  out.y = camera.position.y + camera.bottom;
  out.w = camera.right - camera.left;
  out.h = camera.top - camera.bottom;
  return out;
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

/**
 * `frame`, framed for `layoutSize`, grown about its top-left corner to show `viewSize`. A window's
 * canvas draws scaled by its content scale factor from the same origin (`window.cpp:1366`), so its
 * target shows its pixels over the factor in canvas units, whatever rect a Camera2D centres in.
 */
export function frameOverView(frame: OrthoFrame, layoutSize: Vector2, viewSize: Vector2): OrthoFrame {
  if (layoutSize.x === viewSize.x && layoutSize.y === viewSize.y) return frame;
  return {
    ...frame,
    right: frame.left + ((frame.right - frame.left) * viewSize.x) / layoutSize.x,
    bottom: frame.top - ((frame.top - frame.bottom) * viewSize.y) / layoutSize.y,
  };
}
