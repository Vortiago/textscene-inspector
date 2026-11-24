/**
 * Zoom that keeps what is under the pointer under the pointer: the previewer's one
 * departure from Godot's navigation (ADR-0029), whose zoom flies at the focus point.
 * It lives outside `godotEditorCursor.ts`, whose contract is that everything in it
 * is Godot's.
 */
import {
  orthographicHeight,
  scaleCursorDistance,
  slideCursorInViewPlane,
  type EditorCursor,
  type ZoomRange,
} from './godotEditorCursor.js';

/** Where the pointer is, relative to the viewport it is over. */
export interface PointerView {
  /** Pointer offset from the viewport centre, in CSS pixels (+x right). */
  readonly offsetX: number;
  /** Pointer offset from the viewport centre, in CSS pixels (+y down). */
  readonly offsetY: number;
  /** Viewport height in CSS pixels: what the vertical fov spans. */
  readonly height: number;
  /** Vertical field of view, in degrees. */
  readonly fovDegrees: number;
}

/**
 * Scale the orbit radius and slide the target so the point under the pointer on the
 * focus plane stays put. No raycast: it behaves the same over empty space. A clamped
 * zoom moves the eye nowhere, so it slides the target nowhere either.
 */
export function zoomCursorToPointer(
  cursor: EditorCursor,
  scale: number,
  range: ZoomRange,
  view: PointerView
): EditorCursor {
  const zoomed = scaleCursorDistance(cursor, scale, range);
  const travelled = cursor.distance - zoomed.distance;
  // `!(height > 0)` rather than `<= 0`, so a NaN height is rejected too.
  if (travelled === 0 || !(view.height > 0)) return zoomed;

  // `orthographicHeight`, which also sizes the orthographic frustum, so that needs no
  // special case: the focus plane spans `2 * d * tan(fov / 2)`, and shrinking it by
  // `travelled` leaves this many world units per CSS pixel for the target to cross.
  const shift = orthographicHeight(travelled, view.fovDegrees) / view.height;
  const right = view.offsetX * shift;
  // Screen y runs down, world up runs up.
  const up = -view.offsetY * shift;
  // One check covers a non-finite offset or fov, which reach the target only here.
  // A NaN target never recovers, since every later gesture re-derives from it.
  if (!Number.isFinite(right) || !Number.isFinite(up)) return zoomed;

  return slideCursorInViewPlane(zoomed, right, up);
}
