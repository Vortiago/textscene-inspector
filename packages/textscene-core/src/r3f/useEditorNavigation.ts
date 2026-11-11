/**
 * The pointer, wheel and view-key inputs of a Godot-editor viewport gesture, routed onto an
 * `EditorControlsHandle`. The handlers share one effect, so the cleanup detaches exactly the
 * listeners it attached. The gestures themselves live in `editorMouseNavigation.ts`,
 * `editorTouchGesture.ts` and `editorKeyBindings.ts`. Freelook's keys are in `useFreelook.ts`.
 */

import type { RootState } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { isTypingTarget } from './hooks/isTypingTarget.js';
import type { EditorControlsHandle } from './EditorControlsHandle.js';
import type { Freelook } from './freelook.js';
import { resolveNavMode } from './godotEditorCursor.js';
import { isGesturePointer, type TouchPoint } from './pointerGesture.js';
import { applyEditorDragMove, applyEditorWheel, type DragState } from './editorMouseNavigation.js';
import {
  applyEditorTouchMove,
  beginEditorTouch,
  endEditorTouch,
  type TouchGesture,
} from './editorTouchGesture.js';
import { applyEditorViewKey, consumeEditorViewKey } from './editorKeyBindings.js';

export function useEditorNavigation(
  gl: RootState['gl'],
  handle: EditorControlsHandle,
  freelook: Freelook,
  invalidate: RootState['invalidate'],
  get: RootState['get']
): void {
  const dragRef = useRef<DragState | null>(null);
  // Every touch pointer currently down, in the order it landed: a pinch needs
  // two at once, which a single drag slot cannot hold.
  const touchPointsRef = useRef<Map<number, TouchPoint>>(new Map());
  const touchGestureRef = useRef<TouchGesture | null>(null);

  useEffect(() => {
    const element = gl.domElement;
    // Captured once, so the cleanup clears the Map the handlers filled, not
    // whatever `.current` holds by then.
    const touchPoints = touchPointsRef.current;

    // Godot ignores every navigation input while it previews a Camera3D
    // (`node_3d_editor_plugin.cpp:1826-1829`), so neither camera moves. A gesture
    // under way when a preview starts stops moving the camera with it.
    const isPreviewing = (): boolean => handle.isPreviewing(get().camera);

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
      freelook.setHeld(false);
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
      if (isPreviewing()) return;
      if (isGesturePointer(event.pointerType)) {
        beginEditorTouch(event, touchPoints, touchGestureRef);
        return;
      }
      if (dragRef.current) return;
      const mode = resolveNavMode(event.button, event, handle.projection);
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
      freelook.setHeld(mode === 'freelook');
      element.setPointerCapture?.(event.pointerId);
    }

    function handlePointerMove(event: PointerEvent): void {
      if (isPreviewing()) return;
      if (isGesturePointer(event.pointerType)) {
        if (applyEditorTouchMove(event, touchPoints, touchGestureRef, handle)) invalidate();
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      if (applyEditorDragMove(event, drag, handle)) invalidate();
    }

    function handleWheel(event: WheelEvent): void {
      event.preventDefault();
      if (isPreviewing()) return;
      if (applyEditorWheel(event, handle, freelook, get)) invalidate();
    }

    function handleContextMenu(event: MouseEvent): void {
      event.preventDefault();
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (isTypingTarget(event.target)) return;
      if (isPreviewing()) {
        consumeEditorViewKey(event);
        return;
      }
      if (applyEditorViewKey(event, handle)) invalidate();
    }

    // A window blur lifts fingers with no pointerup.
    function handleBlur(): void {
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
      window.removeEventListener('blur', handleBlur);
      endDrag();
      resetTouch();
    };
  }, [gl, handle, freelook, invalidate, get]);
}
