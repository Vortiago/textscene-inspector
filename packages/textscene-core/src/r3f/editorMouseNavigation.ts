/**
 * The mouse half of viewport navigation: the drag (orbit / pan / zoom /
 * freelook, by button and modifier) and the wheel.
 *
 * Each entry point edits the cursor directly and reports whether the view
 * moved, so the caller owns the single `invalidate()`.
 */

import type { RootState } from '@react-three/fiber';
import type { EditorControlsHandle } from './EditorControlsHandle.js';
import type { Freelook } from './freelook.js';
import {
  dollyCursor,
  freelookCursor,
  orbitCursor,
  panCursor,
  resolveNavMode,
  resolveWheelMode,
  wheelZoomScale,
} from './godotEditorCursor.js';
import { wheelDeltaPixels } from './pointerGesture.js';
import { zoomCursorToPointer } from './zoomToPointer.js';

export interface DragState {
  pointerId: number;
  button: number;
  x: number;
  y: number;
}

/**
 * One mouse `pointermove` during a drag. Mutates `drag`'s last position and
 * returns whether the view moved.
 */
export function applyEditorDragMove(
  event: PointerEvent,
  drag: DragState,
  handle: EditorControlsHandle
): boolean {
  if (event.pointerId !== drag.pointerId) return false;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  drag.x = event.clientX;
  drag.y = event.clientY;
  if (dx === 0 && dy === 0) return false;

  const mode = resolveNavMode(drag.button, event, handle.projection);
  // A released modifier (alt on an alt+left drag) suspends navigation without ending the drag,
  // as in Godot.
  if (!mode) return false;

  const cursor = handle.cursor();
  if (mode === 'orbit') handle.applyCursor(orbitCursor(cursor, dx, dy));
  else if (mode === 'pan') handle.applyCursor(panCursor(cursor, dx, dy));
  else if (mode === 'zoom') handle.applyCursor(dollyCursor(cursor, dy, handle.zoomRange()));
  else handle.applyCursor(freelookCursor(cursor, dx, dy));
  return true;
}

/**
 * One wheel event: the flight speed while freelook is on, as in Godot
 * (`node_3d_editor_plugin.cpp:1880-1888`), else pan under shift and zoom otherwise.
 * Returns whether the view moved.
 */
export function applyEditorWheel(
  event: WheelEvent,
  handle: EditorControlsHandle,
  freelook: Freelook,
  get: RootState['get']
): boolean {
  if (freelook.isActive) {
    // A wheel-up notch shrinks the orbit radius and raises the speed, so the two scales are inverse.
    const scale = 1 / wheelZoomScale(event);
    if (scale !== 1) freelook.scaleSpeed(scale, handle.zoomRange());
    return false;
  }
  if (resolveWheelMode(event) === 'pan') {
    // Godot pans by the negated gesture delta, and the delta has to be
    // normalised first: one notch is 100px in Chrome but 3 lines in
    // Firefox, so raw deltas would pan 33x further in one than the other.
    const { dx, dy } = wheelDeltaPixels(event);
    if (dx === 0 && dy === 0) return false;
    handle.applyCursor(panCursor(handle.cursor(), -dx, -dy));
    return true;
  }
  const scale = wheelZoomScale(event);
  if (scale === 1) return false;
  // Zoom toward the pointer, not the focus point (ADR-0029's one departure from Godot).
  // `offsetX`/`offsetY` force a layout flush, but nothing on this path writes to the DOM, so the
  // flush early-outs. Read through `get()`, not a mirrored ref: the store is stable.
  const view = get().size;
  handle.applyCursor(
    zoomCursorToPointer(handle.cursor(), scale, handle.zoomRange(), {
      offsetX: event.offsetX - view.width / 2,
      offsetY: event.offsetY - view.height / 2,
      height: view.height,
      fovDegrees: handle.fovDegrees(),
    })
  );
  return true;
}
