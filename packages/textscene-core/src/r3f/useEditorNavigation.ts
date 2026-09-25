/**
 * Every input of a Godot-editor viewport gesture (pointer, wheel, keyboard, per-frame
 * freelook) routed onto an `EditorControlsHandle`. The handlers share one effect, so
 * the cleanup detaches exactly the listeners it attached. The gestures themselves
 * live in `editorMouseNavigation.ts`, `editorTouchGesture.ts` and `editorKeyBindings.ts`.
 */

import { useFrame, type RootState } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { isTypingTarget } from './hooks/isTypingTarget.js';
import type { EditorControlsHandle } from './EditorControlsHandle.js';
import { freelookMoveCursor, resolveNavMode } from './godotEditorCursor.js';
import { isGesturePointer, type TouchPoint } from './pointerGesture.js';
import {
  applyEditorDragMove,
  applyEditorWheel,
  type DragState,
} from './editorMouseNavigation.js';
import {
  applyEditorTouchMove,
  beginEditorTouch,
  endEditorTouch,
  type TouchGesture,
} from './editorTouchGesture.js';
import { applyEditorViewKey, freelookKeysFrom, FREELOOK_KEYS } from './editorKeyBindings.js';

export function useEditorNavigation(
  gl: RootState['gl'],
  handle: EditorControlsHandle,
  invalidate: RootState['invalidate'],
  get: RootState['get']
): void {
  const dragRef = useRef<DragState | null>(null);
  // Every touch pointer currently down, in the order it landed: a pinch needs
  // two at once, which a single drag slot cannot hold.
  const touchPointsRef = useRef<Map<number, TouchPoint>>(new Map());
  const touchGestureRef = useRef<TouchGesture | null>(null);
  const freelookRef = useRef(false);
  const heldKeysRef = useRef<Set<string>>(new Set());
  const sprintRef = useRef(false);

  useEffect(() => {
    const element = gl.domElement;
    // Captured once, so the cleanup clears the Map the handlers filled, not
    // whatever `.current` holds by then.
    const touchPoints = touchPointsRef.current;

    /**
     * The invariant every touch path keeps: no fingers, no gesture origin. A stale
     * origin would make the next single-finger drag pan from where a pinch ended.
     */
    function resetTouch(): void {
      touchPoints.clear();
      touchGestureRef.current = null;
    }

    function endDrag(): void {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      freelookRef.current = false;
      heldKeysRef.current.clear();
      sprintRef.current = false;
      if (element.hasPointerCapture?.(drag.pointerId)) {
        element.releasePointerCapture(drag.pointerId);
      }
    }

    function endPointer(event: PointerEvent): void {
      if (isGesturePointer(event.pointerType)) {
        endEditorTouch(event, touchPoints, touchGestureRef);
        return;
      }
      endDrag();
    }

    function handlePointerDown(event: PointerEvent): void {
      if (isGesturePointer(event.pointerType)) {
        beginEditorTouch(event, touchPoints, touchGestureRef);
        return;
      }
      if (dragRef.current) return;
      const mode = resolveNavMode(event.button, event);
      if (!mode) return;
      // Middle-click otherwise opens the platform's auto-scroll widget, which
      // eats every subsequent motion event.
      event.preventDefault();
      dragRef.current = {
        pointerId: event.pointerId,
        button: event.button,
        x: event.clientX,
        y: event.clientY,
      };
      freelookRef.current = mode === 'freelook';
      element.setPointerCapture?.(event.pointerId);
    }

    function handlePointerMove(event: PointerEvent): void {
      if (isGesturePointer(event.pointerType)) {
        if (applyEditorTouchMove(event, touchPoints, touchGestureRef, handle)) invalidate();
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      const moved = applyEditorDragMove(event, drag, handle, (freelook) => {
        freelookRef.current = freelook;
      });
      if (moved) invalidate();
    }

    function handleWheel(event: WheelEvent): void {
      event.preventDefault();
      if (applyEditorWheel(event, handle, get)) invalidate();
    }

    function handleContextMenu(event: MouseEvent): void {
      event.preventDefault();
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (isTypingTarget(event.target)) return;

      // Read the sprint modifier off the event rather than tracking its own
      // keydown: Shift held before freelook started never fires one.
      sprintRef.current = event.shiftKey;
      if (freelookRef.current && FREELOOK_KEYS[event.code]) {
        heldKeysRef.current.add(event.code);
        event.preventDefault();
        return;
      }

      if (applyEditorViewKey(event, handle)) invalidate();
    }

    function handleKeyUp(event: KeyboardEvent): void {
      sprintRef.current = event.shiftKey;
      heldKeysRef.current.delete(event.code);
    }

    function handleBlur(): void {
      heldKeysRef.current.clear();
      sprintRef.current = false;
      resetTouch();
    }

    element.addEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointermove', handlePointerMove);
    element.addEventListener('pointerup', endPointer);
    element.addEventListener('pointercancel', endPointer);
    element.addEventListener('lostpointercapture', endPointer);
    element.addEventListener('contextmenu', handleContextMenu);
    // Not passive: a zoom must not also scroll the page behind the canvas.
    element.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      element.removeEventListener('pointerdown', handlePointerDown);
      element.removeEventListener('pointermove', handlePointerMove);
      element.removeEventListener('pointerup', endPointer);
      element.removeEventListener('pointercancel', endPointer);
      element.removeEventListener('lostpointercapture', endPointer);
      element.removeEventListener('contextmenu', handleContextMenu);
      element.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      endDrag();
      resetTouch();
    };
  }, [gl, handle, invalidate, get]);

  // Freelook flight is continuous while the keys are held, so it advances per
  // frame with the frame's own delta rather than per keydown repeat.
  useFrame((_, delta) => {
    if (!freelookRef.current || heldKeysRef.current.size === 0) return;
    const keys = freelookKeysFrom(heldKeysRef.current, sprintRef.current);
    handle.applyCursor(freelookMoveCursor(handle.cursor(), keys, delta));
  });
}
