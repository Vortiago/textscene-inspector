/**
 * Multi-pointer gesture geometry, shared by both viewports.
 *
 * Deliberately NOT part of `godotEditorCursor.ts`: that module is Godot's own
 * editor maths with Godot's own constants, and Godot's editor has no touch
 * scheme at all (ADR-0029). Putting fingers in there would make its "constants
 * are Godot's own" claim false. Keeping them apart also lets the 2D stage —
 * which has no orbit camera and no editor cursor — use the same geometry
 * without importing the 3D navigation module.
 *
 * Pure and DOM-free, so both viewports test their gesture handling without a
 * canvas. What each viewport does with the geometry differs and stays local:
 * 3D orbits one finger and pans two, 2D pans either.
 */

/** A pointer position, in client pixels. */
export interface TouchPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Below this the fingers are effectively coincident and a pinch has no
 * direction to read a scale from. Client pixels — the unit both viewports
 * receive, whatever their camera model measures in.
 */
export const DEGENERATE_SPAN_PX = 1e-3;

/**
 * Which navigation a touch gesture drives in the 3D viewport, from how many
 * fingers are down: one orbits, two pan (and pinch, on the same two pointers).
 * Three or more is not a gesture either viewport defines — better to ignore it
 * than to move the view by a midpoint the user is not thinking in terms of.
 *
 * A tap is not a mode: it falls out of one-finger orbit, since viewport
 * selection already discriminates a tap from a drag by distance travelled.
 * Freelook has no touch binding — it needs a held button plus WASD.
 */
export function resolveTouchMode(pointerCount: number): 'orbit' | 'pan' | null {
  if (pointerCount === 1) return 'orbit';
  if (pointerCount === 2) return 'pan';
  return null;
}

/** The midpoint the fingers pan about. */
export function touchCentroid(points: readonly TouchPoint[]): TouchPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return { x: x / points.length, y: y / points.length };
}

/** How far apart the first two fingers are — the quantity a pinch changes. */
export function touchSpan(points: readonly TouchPoint[]): number {
  const [first, second] = points;
  if (!first || !second) return 0;
  return Math.hypot(first.x - second.x, first.y - second.y);
}

/**
 * How much the fingers spread, as a ratio: greater than 1 when they move
 * apart. Deliberately direction-free — each viewport applies it the way ITS
 * zoom runs, and the two run opposite ways (a 2D CSS scale grows as the
 * fingers spread, a 3D orbit radius shrinks). Returning the raw ratio and
 * letting each call site invert it where needed keeps that inversion visible
 * instead of hiding it behind a name that reads the same at both.
 *
 * A degenerate span — coincident fingers, or the first move of a gesture with
 * no previous span yet — yields 1 rather than a division blow-up.
 */
export function pinchSpanRatio(previousSpan: number, span: number): number {
  if (previousSpan <= DEGENERATE_SPAN_PX || span <= DEGENERATE_SPAN_PX) return 1;
  return span / previousSpan;
}
