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
 * FOCUS PLANE (through the target, perpendicular to the view). Zooming from `d`
 * to `d'` shrinks that plane, and sliding the target by the difference pins the
 * point in place. It needs no scene geometry, so it behaves the same over empty
 * space as over a mesh.
 *
 * Both halves are borrowed rather than restated: `orthographicHeight` already
 * owns how far the plane spans for a distance and fov — which is also why
 * orthographic needs no special case, since its frustum is sized by that same
 * function — and `slideCursorInViewPlane` already owns moving the target across
 * it.
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
  // `!(height > 0)` rather than `<= 0`, so a NaN height is rejected too.
  if (travelled === 0 || !(view.height > 0)) return zoomed;

  // The same formula the orthographic frustum is sized by: the focus plane
  // spans `2 * d * tan(fov / 2)`, so shrinking it by `travelled` leaves this
  // many world units per CSS pixel for the target to cross.
  const shift = orthographicHeight(travelled, view.fovDegrees) / view.height;
  const right = view.offsetX * shift;
  // Screen y runs down, world up runs up.
  const up = -view.offsetY * shift;
  // One check covers a non-finite offset OR fov, since both reach the target
  // only through here. Without it a pointer position the browser never
  // supplied would write a NaN the camera could never recover from — every
  // later gesture re-derives from that target.
  if (!Number.isFinite(right) || !Number.isFinite(up)) return zoomed;

  return slideCursorInViewPlane(zoomed, right, up);
}
