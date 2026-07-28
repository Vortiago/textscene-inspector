/**
 * Zoom that keeps what is under the pointer under the pointer.
 *
 * This is the previewer's ONE deliberate departure from Godot's navigation
 * (ADR-0029). Godot's `scale_cursor_distance` edits only `cursor.distance`, so
 * zooming always flies at the focus point — which framing put at the centre of
 * the whole scene. Zoom in on anything off-centre and it slides away, and
 * recovering costs a stack of pan drags precisely because pan speed is
 * (correctly) proportional to the now-small distance. On a large scene that
 * makes close inspection genuinely tedious; Godot's own mitigation is to press
 * F on a selection, which is discoverable only if you already know.
 *
 * Kept out of `godotEditorCursor.ts` for the same reason the gesture and wheel
 * maths are: that module's contract is that everything in it is Godot's.
 *
 * The maths, without a raycast: hold fixed the point under the pointer ON THE
 * FOCUS PLANE (through the target, perpendicular to the view). That plane spans
 * `2 * d * tan(fov / 2)` vertically, so one CSS pixel is
 * `2 * tan(fov / 2) / viewportHeight` world units per unit of distance. Zooming
 * from `d` to `d'` shrinks the plane, and shifting the target by the difference
 * — along the camera's own right/up — pins that point in place. It needs no
 * scene geometry, so it behaves the same over empty space as over a mesh.
 *
 * Orthographic works unchanged: `orthographicHeight` derives the frustum from
 * the same distance and fov, so the plane it spans is identical.
 */
import * as THREE from 'three';
import {
  cursorQuaternion,
  scaleCursorDistance,
  type EditorCursor,
  type ZoomRange,
} from './godotEditorCursor.js';

/** Where the pointer is, relative to the viewport it is over. */
export interface PointerView {
  /** Pointer offset from the viewport centre, in CSS pixels (+x right). */
  readonly offsetX: number;
  /** Pointer offset from the viewport centre, in CSS pixels (+y DOWN). */
  readonly offsetY: number;
  /** Viewport height in CSS pixels — what the vertical fov spans. */
  readonly height: number;
  /** Vertical field of view, in degrees. */
  readonly fovDegrees: number;
}

/**
 * Scale the orbit radius and slide the focus point so the pointer keeps its
 * grip on the scene.
 *
 * A clamped zoom (the range floor or ceiling) moves the eye nowhere, so it
 * slides the target nowhere either — the view stops dead instead of creeping
 * sideways while the user keeps scrolling.
 */
export function zoomCursorToPointer(
  cursor: EditorCursor,
  scale: number,
  range: ZoomRange,
  view: PointerView
): EditorCursor {
  const zoomed = scaleCursorDistance(cursor, scale, range);
  const travelled = cursor.distance - zoomed.distance;
  // No usable pointer position (a synthesised event with no offsets, a
  // zero-height viewport mid-layout) falls back to Godot's centre zoom rather
  // than writing a NaN into the target — which the camera never recovers from,
  // since every later gesture derives from it.
  if (
    travelled === 0 ||
    !(view.height > 0) ||
    !Number.isFinite(view.offsetX) ||
    !Number.isFinite(view.offsetY) ||
    !Number.isFinite(view.fovDegrees)
  ) {
    return zoomed;
  }

  const unitsPerPixel = (2 * Math.tan((view.fovDegrees * Math.PI) / 360)) / view.height;
  const shift = travelled * unitsPerPixel;
  const basis = cursorQuaternion(cursor);
  const target = cursor.target
    .clone()
    .add(new THREE.Vector3(1, 0, 0).applyQuaternion(basis).multiplyScalar(view.offsetX * shift))
    // Screen y runs down, world up runs up.
    .add(new THREE.Vector3(0, 1, 0).applyQuaternion(basis).multiplyScalar(-view.offsetY * shift));
  return { ...zoomed, target };
}
