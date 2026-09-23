/**
 * Browser pointer input reduced to numbers a camera can use: gesture geometry,
 * and wheel deltas in notches and CSS pixels, shared by both viewports. None of it
 * is Godot's (its editor has no touch scheme, ADR-0029), so it stays apart from
 * `godotEditorCursor.ts`. Pure and DOM-free.
 */

/** A pointer position, in client pixels. */
export interface TouchPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Whether a pointer navigates by gesture rather than by button. A `pen` counts:
 * on the mouse path its drag is `button: 0`, which selects, and a tablet has no
 * middle button or Alt key. A pen orbits and taps as one finger and never pinches.
 */
export function isGesturePointer(pointerType: string): boolean {
  return pointerType === 'touch' || pointerType === 'pen';
}

/**
 * Below this the fingers are coincident and a pinch has no scale to read. In
 * client pixels, the unit both viewports receive.
 */
export const DEGENERATE_SPAN_PX = 1e-3;

/**
 * Which navigation a touch gesture drives in the 3D viewport: one finger orbits,
 * two pan and pinch, and three or more do nothing. A tap falls out of one-finger
 * orbit, since selection tells a tap from a drag by distance. Freelook has no
 * touch binding: it needs a held button plus WASD.
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

/** How far apart the first two fingers are: the quantity a pinch changes. */
export function touchSpan(points: readonly TouchPoint[]): number {
  const [first, second] = points;
  if (!first || !second) return 0;
  return Math.hypot(first.x - second.x, first.y - second.y);
}

/**
 * How much the fingers spread, as a ratio above 1 when they move apart, or 1 for
 * a degenerate span. Direction-free: a 2D CSS scale grows as the fingers spread
 * and a 3D orbit radius shrinks, so each call site shows its own inversion.
 */
export function pinchSpanRatio(previousSpan: number, span: number): number {
  if (previousSpan <= DEGENERATE_SPAN_PX || span <= DEGENERATE_SPAN_PX) return 1;
  return span / previousSpan;
}

/** Pixels of `deltaY` a browser reports for one wheel notch. */
const WHEEL_NOTCH_PIXELS = 100;

/**
 * Pixels per line for `deltaMode === 1`. A browser reporting lines sends
 * `deltaY = 3` per notch, so a notch is three lines: a real ~16px line would read
 * a notch as 0.48 and zoom Firefox at half of Chrome's rate.
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
 * A wheel event's delta in CSS pixels, for zoom and pan in both viewports. Both
 * axes: with Shift held, Chrome and Firefox deliver the notch on `deltaX`, so a
 * pan that read only `deltaY` would do nothing.
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
