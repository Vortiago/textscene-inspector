/**
 * The touch half of viewport navigation, which Godot has no equivalent for —
 * one-finger drag orbits, two fingers pan and pinch at once.
 *
 * Each entry point edits the cursor directly and reports whether the view
 * moved, so the caller owns the single `invalidate()`.
 */

import type { EditorControlsHandle } from './EditorControlsHandle.js';
import {
  orbitCursor,
  panCursor,
  scaleCursorDistance,
  type EditorCursor,
} from './godotEditorCursor.js';
import {
  pinchSpanRatio,
  resolveTouchMode,
  touchCentroid,
  touchSpan,
  type TouchPoint,
} from './pointerGesture.js';

/** Where the fingers were on the previous move — a touch gesture's origin. */
export interface TouchGesture {
  /** Previous centroid. The pan is incremental, so this moves every event. */
  centroid: TouchPoint;
  /** Previous separation, kept only to recognise an event that changed nothing. */
  span: number;
  /**
   * Separation and orbit radius when the gesture was seeded — the pinch's
   * anchor, which is why the zoom is measured rather than accumulated. A
   * browser fires one `pointermove` PER POINTER, so two fingers sliding
   * together transit mixed-time states whose span swings hard: 100px apart,
   * briefly 40px once one has moved, 100px again once the other catches up.
   * Multiplying those ratios unwinds the excursion only while nothing clamps
   * it, and `scaleCursorDistance` clamps on every call — so one clamped
   * excursion never unwinds and a pure pan silently rescales the view.
   */
  startSpan: number;
  startDistance: number;
}

export type TouchGestureRef = { current: TouchGesture | null };

/**
 * A finger landing. Touch pointers are implicitly captured to the target, so no
 * explicit capture — and no preventDefault, which would cost tap-to-select the
 * pointerup R3F picks it out of. `touch-action: none` on the canvas is what
 * stops the browser scrolling instead.
 */
export function beginEditorTouch(
  event: PointerEvent,
  touchPoints: Map<number, TouchPoint>,
  gestureRef: TouchGestureRef
): void {
  touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
  // A finger landing or leaving changes the centroid and the span
  // discontinuously; dropping the origin re-seeds both on the next move
  // so the view doesn't jump.
  gestureRef.current = null;
}

/** A finger lifting. */
export function endEditorTouch(
  event: PointerEvent,
  touchPoints: Map<number, TouchPoint>,
  gestureRef: TouchGestureRef
): void {
  touchPoints.delete(event.pointerId);
  // Lifting one of two fingers leaves the other mid-gesture; re-seed so
  // the survivor orbits from where it is rather than from the centroid.
  gestureRef.current = null;
}

/** One touch `pointermove`. Returns whether the view moved. */
export function applyEditorTouchMove(
  event: PointerEvent,
  touchPoints: Map<number, TouchPoint>,
  gestureRef: TouchGestureRef,
  handle: EditorControlsHandle
): boolean {
  if (!touchPoints.has(event.pointerId)) return false;
  touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });

  const active = [...touchPoints.values()];
  const mode = resolveTouchMode(active.length);
  if (!mode) {
    gestureRef.current = null;
    return false;
  }

  const centroid = touchCentroid(active);
  const span = touchSpan(active);
  const previous = gestureRef.current;
  // The first move of a gesture only establishes what it started from.
  if (!previous) {
    gestureRef.current = {
      centroid,
      span,
      startSpan: span,
      startDistance: handle.cursor().distance,
    };
    return false;
  }
  gestureRef.current = { ...previous, centroid, span };

  const dx = centroid.x - previous.centroid.x;
  const dy = centroid.y - previous.centroid.y;
  // One move per pointer means a two-finger gesture also delivers events
  // in which nothing moved: nothing to apply, nothing to redraw. The
  // mouse path guards the same way.
  if (dx === 0 && dy === 0 && span === previous.span) return false;

  if (mode === 'orbit') {
    handle.applyCursor(orbitCursor(handle.cursor(), dx, dy));
  } else {
    // Two fingers pan and pinch at once, exactly as they do on a map: the
    // centroid drives the pan, the span between them drives the zoom.
    //
    // The zoom is measured from the anchor, never accumulated (see
    // `TouchGesture`), which makes each event idempotent: a clamp on one
    // cannot carry into the next. Inverted, because spreading the fingers
    // pulls the eye IN — the radius goes as the reciprocal of the spread.
    const spread = pinchSpanRatio(previous.startSpan, span);
    const anchored: EditorCursor = { ...handle.cursor(), distance: previous.startDistance };
    const zoomed = scaleCursorDistance(anchored, 1 / spread, handle.zoomRange());
    handle.applyCursor(panCursor(zoomed, dx, dy));
  }
  return true;
}
