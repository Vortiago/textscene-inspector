/**
 * Browser pointer input reduced to numbers a camera can use — multi-pointer
 * gesture geometry, and wheel deltas normalised to notches and CSS pixels.
 * Shared by both viewports.
 *
 * Deliberately NOT part of `godotEditorCursor.ts`: that module is Godot's own
 * editor maths with Godot's own constants, and NONE of this is Godot's. Godot's
 * editor has no touch scheme at all (ADR-0029), and a `deltaMode` is a browser
 * fact its native input events never carry — putting either in there would make
 * its "constants are Godot's own" claim false. Keeping them apart also lets the
 * 2D stage — which has no orbit camera and no editor cursor — share the lot
 * without importing the 3D navigation module.
 *
 * Pure and DOM-free, so both viewports test their gesture handling without a
 * canvas. What each viewport does with the numbers differs and stays local: 3D
 * orbits one finger and pans two, 2D pans either.
 */

/** A pointer position, in client pixels. */
export interface TouchPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Whether a pointer navigates by gesture rather than by button.
 *
 * A stylus counts. It reports `pointerType: 'pen'`, and routing it to the mouse
 * path leaves it completely inert on the device class touch was added for: a
 * pen drag is `button: 0` with no modifiers, which navigation deliberately
 * declines in favour of selection, and a detached tablet has neither a middle
 * button nor an Alt key to reach the fallbacks with. A pen is single-pointer,
 * so it orbits and taps exactly as one finger does and never pinches.
 */
export function isGesturePointer(pointerType: string): boolean {
  return pointerType === 'touch' || pointerType === 'pen';
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

/** Pixels of `deltaY` a browser reports for one wheel notch. */
const WHEEL_NOTCH_PIXELS = 100;

/**
 * Pixels per line for `deltaMode === 1`. A browser reporting lines sends
 * `deltaY = 3` for one notch, so a notch is three lines — not the ~16px of an
 * actual text line, which would make one notch read as 0.48 and zoom Firefox
 * at roughly half of Chrome's rate.
 */
const WHEEL_LINE_PIXELS = WHEEL_NOTCH_PIXELS / 3;

/**
 * How many notches a single wheel event may be worth. A trackpad streams
 * fractions of a notch; a kinetic fling or a coarse driver can deliver a
 * whole screenful in one event, which without a cap would teleport the view.
 */
export const WHEEL_MAX_NOTCHES = 4;

/** The axes of a wheel event, in CSS pixels whatever `deltaMode` it used. */
export interface WheelDelta {
  dx: number;
  dy: number;
}

/** A wheel event's two axes and, on the rarer `deltaMode`s, their unit. */
export interface WheelEventLike {
  deltaX?: number;
  deltaY: number;
  deltaMode?: number;
}

/**
 * CSS pixels one unit of `deltaY` represents. `deltaMode` 0 already reports
 * pixels; 1 reports lines (three to a notch); 2 reports pages (one to a notch).
 */
function wheelPixelsPerUnit(deltaMode: number | undefined): number {
  if (deltaMode === 1) return WHEEL_LINE_PIXELS;
  if (deltaMode === 2) return WHEEL_NOTCH_PIXELS;
  return 1;
}

/**
 * A wheel event's delta in CSS pixels. Browsers report a notch as ~100px, but
 * in lines or pages for the rarer `deltaMode`s, so every consumer has to
 * normalise before it can treat the number as a distance — zoom AND pan, in
 * both viewports, which is why this is shared rather than inlined into one.
 *
 * Both axes, always: with Shift held on a mouse wheel, Chrome and Firefox
 * deliver the notch on `deltaX` instead of `deltaY`, so a pan that read only
 * `deltaY` would silently do nothing.
 */
export function wheelDeltaPixels(event: WheelEventLike): WheelDelta {
  const perUnit = wheelPixelsPerUnit(event.deltaMode);
  return { dx: (event.deltaX ?? 0) * perUnit, dy: event.deltaY * perUnit };
}

/** How many notches a wheel event's vertical delta is worth. */
export function wheelNotches(event: WheelEventLike): number {
  return (event.deltaY * wheelPixelsPerUnit(event.deltaMode)) / WHEEL_NOTCH_PIXELS;
}

/** One event's notch count, held to `WHEEL_MAX_NOTCHES` in either direction. */
export function clampWheelNotches(notches: number): number {
  return Math.max(-WHEEL_MAX_NOTCHES, Math.min(WHEEL_MAX_NOTCHES, notches));
}
