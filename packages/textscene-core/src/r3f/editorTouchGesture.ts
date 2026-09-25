/**
 * The touch half of viewport navigation, which Godot has no equivalent for: one finger orbits, two
 * fingers pan and pinch at once.
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

/** Where the fingers were on the previous move: a touch gesture's origin. */
export interface TouchGesture {
  /** Previous centroid. The pan is incremental, so this moves every event. */
  centroid: TouchPoint;
  /** Previous separation, kept only to recognise an event that changed nothing. */
  span: number;
  /**
   * Separation and orbit radius at the seed: the pinch anchor the zoom is measured from. One
   * `pointermove` fires per pointer, so the span swings between moves (100 px, 40 px, 100 px), and
   * accumulated ratios would not unwind once `scaleCursorDistance` clamps one.
   */
  startSpan: number;
  startDistance: number;
}

export type TouchGestureRef = { current: TouchGesture | null };

/**
 * A finger landing. Touch pointers are captured to the target implicitly. No `preventDefault`,
 * which would cost tap-to-select its pointerup; `touch-action: none` on the canvas stops scrolling.
 */
export function beginEditorTouch(
  event: PointerEvent,
  touchPoints: Map<number, TouchPoint>,
  gestureRef: TouchGestureRef
): void {
  touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
  // A finger landing changes the centroid and span discontinuously, so dropping the origin
  // re-seeds both on the next move and the view does not jump.
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
    // The centroid drives the pan and the span the zoom, measured from the anchor so a clamp on one
    // event cannot carry into the next. Inverted: spreading the fingers pulls the eye in.
    const spread = pinchSpanRatio(previous.startSpan, span);
    const anchored: EditorCursor = { ...handle.cursor(), distance: previous.startDistance };
    const zoomed = scaleCursorDistance(anchored, 1 / spread, handle.zoomRange());
    handle.applyCursor(panCursor(zoomed, dx, dy));
  }
  return true;
}
