/**
 * How a sub-viewport's offscreen pass frames its target: the camera it draws through and the
 * orthographic frame of its canvas, free of R3F so each is asserted directly.
 */

import * as THREE from 'three';
import { canvasFrameOf } from '../canvasFrame';
import { camera2DView, type Camera2DPlacement, type Camera2DTag } from './camera2DView';
import type { Vector2 } from '../../godot/math/vector';
import type { Rect2 } from '../../godot/math/rect2';

/** The first object under `root` drawn for the node at `cameraPath` that `isCamera` accepts. */
function objectAtPath(
  root: THREE.Object3D,
  cameraPath: string | null,
  isCamera: (object: THREE.Object3D) => boolean
): THREE.Object3D | null {
  if (cameraPath === null) return null;
  let found: THREE.Object3D | null = null;
  root.traverse((object) => {
    if (!found && isCamera(object) && object.userData?.tscnPath === cameraPath) found = object;
  });
  return found;
}

/** The scene's camera at `cameraPath`, the viewport's current camera, or null before it mounts. */
export function cameraAtPath(root: THREE.Object3D, cameraPath: string | null): THREE.Camera | null {
  return objectAtPath(
    root,
    cameraPath,
    (object) => (object as THREE.Camera).isCamera === true
  ) as THREE.Camera | null;
}

/** The group of the Camera2D at `cameraPath`, the viewport's current one, or null before it mounts. */
export function camera2DAtPath(root: THREE.Object3D, cameraPath: string | null): THREE.Object3D | null {
  return objectAtPath(root, cameraPath, (object) => Boolean(object.userData?.camera2d));
}

/** Written only by {@link godotCanvasPlacement}, which reads it before returning. */
const inCanvas = new THREE.Matrix4();

/** The global position and rotation Godot reads, in a CanvasLayer's own canvas (`canvas_item.cpp:176`). */
export function godotCanvasPlacement(object: THREE.Object3D): { x: number; y: number; rotation: number } {
  inCanvas.copy(object.matrixWorld);
  const frame = canvasFrameOf(object);
  if (frame) inCanvas.premultiply(frame.matrixWorld.clone().invert());
  const m = inCanvas.elements;
  return { x: m[12]!, y: -m[13]!, rotation: 0 - Math.atan2(m[1]!, m[0]!) };
}

/**
 * Frame the target rect through a Camera2D. `camera2DView`, shared with the Cameras
 * panel, computes the view rect. The projection is `size / zoom` pixels wide,
 * centred on the view, at z 1000 so draw order does not shift.
 */
export function orthoFrameForCamera2D(
  framing: Camera2DTag,
  placement: Camera2DPlacement,
  size: Vector2
): OrthoFrame {
  const width = size.x > 0 ? size.x : 1;
  const height = size.y > 0 ? size.y : 1;
  const view = camera2DView(framing, placement, { x: width, y: height });
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
    rotation: -view.rotation,
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
  camera.rotation.z = frame.rotation;

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
  /** The camera's turn about Z in three's +Y up space, the negated Camera2D view rotation. */
  rotation: number;
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
    rotation: 0,
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
