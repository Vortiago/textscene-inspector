/**
 * Freelook's own inputs for one canvas: the Shift+F toggle and its pointer lock, the flight keys,
 * the mouse look of the toggle, and the flight per frame. The right-drag that holds freelook on
 * is a pointer gesture, so it stays in `useEditorNavigation.ts`.
 */
import { useFrame, type RootState } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type { EditorControlsHandle } from './EditorControlsHandle.js';
import { isFreelookToggleKey } from './editorKeyBindings.js';
import type { Freelook, FreelookControl } from './freelook.js';
import { freelookCursor } from './godotEditorCursor.js';
import { isTypingTarget } from './hooks/isTypingTarget.js';
import {
  POINTER_LOCK_CHANGE_EVENT,
  exitPointerLock,
  holdsPointerLock,
  requestPointerLock,
} from './pointerLock.js';

/** A lone Alt keyup opens the menu bar on Windows and Linux, which would take the keyboard mid-flight. */
function isAltKey(code: string): boolean {
  return code === 'AltLeft' || code === 'AltRight';
}

export function useFreelook(
  gl: RootState['gl'],
  handle: EditorControlsHandle,
  freelook: Freelook,
  invalidate: RootState['invalidate'],
  get: RootState['get']
): FreelookControl {
  const control = useMemo<FreelookControl>(() => {
    const element = gl.domElement;
    return {
      toggle() {
        if (freelook.isToggled) {
          exitPointerLock(element);
          return;
        }
        // Godot has no freelook in a camera preview (`node_3d_editor_plugin.cpp:1826-1829`) or in
        // orthographic view (`:2741-2742`).
        if (handle.isPreviewing(get().camera) || handle.isOrthographic) return;
        // Focus leaves the control that started the toggle: Space would press a focused button.
        element.tabIndex = -1;
        element.focus({ preventScroll: true });
        requestPointerLock(element);
      },
      getState: freelook.getState,
      subscribe: freelook.subscribe,
    };
  }, [gl, handle, freelook, get]);

  useEffect(() => {
    const element = gl.domElement;
    const lockDocument = element.ownerDocument;

    // The lock is the toggle: the browser ends it on Escape and on a focus change by its own
    // rules, so this one event is where the toggle starts and ends.
    function handlePointerLockChange(): void {
      const isLocked = holdsPointerLock(element);
      freelook.setToggled(isLocked);
      // A locked pointer has no position to pick at, so the canvas neither selects nor hovers.
      get().setEvents({ enabled: !isLocked });
    }

    function handlePointerMove(event: PointerEvent): void {
      if (!freelook.isToggled || handle.isPreviewing(get().camera)) return;
      if (event.movementX === 0 && event.movementY === 0) return;
      handle.applyCursor(freelookCursor(handle.cursor(), event.movementX, event.movementY));
      invalidate();
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (isTypingTarget(event.target)) return;
      if (isFreelookToggleKey(event)) {
        // The page's F shortcut frames the selection, and must not hear the toggle.
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.repeat) control.toggle();
        return;
      }
      if (!freelook.isActive) return;
      // Godot accepts every key event while freelook is on (`node_3d_editor_plugin.cpp:2768-2772`),
      // so no other shortcut of the page hears a key.
      event.stopImmediatePropagation();
      freelook.readModifiers(event);
      if (event.code === 'Escape') {
        exitPointerLock(element);
        return;
      }
      if (freelook.pressKey(event.code) || isAltKey(event.code)) event.preventDefault();
    }

    function handleKeyUp(event: KeyboardEvent): void {
      if (!freelook.isActive) return;
      freelook.readModifiers(event);
      freelook.releaseKey(event.code);
      if (isAltKey(event.code)) event.preventDefault();
    }

    // Godot ends freelook when its window loses focus (`node_3d_editor_plugin.cpp:3579-3581`).
    // A key held then sends no keyup, so the held keys go too.
    function handleFocusLoss(): void {
      freelook.releaseKeys();
      exitPointerLock(element);
    }

    lockDocument.addEventListener(POINTER_LOCK_CHANGE_EVENT, handlePointerLockChange);
    lockDocument.addEventListener('visibilitychange', handleFocusLoss);
    element.addEventListener('pointermove', handlePointerMove);
    // Capture, so these run before every other shortcut's listener on `window`.
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    window.addEventListener('blur', handleFocusLoss);

    return () => {
      lockDocument.removeEventListener(POINTER_LOCK_CHANGE_EVENT, handlePointerLockChange);
      lockDocument.removeEventListener('visibilitychange', handleFocusLoss);
      element.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
      window.removeEventListener('blur', handleFocusLoss);
      exitPointerLock(element);
      freelook.setToggled(false);
    };
  }, [gl, handle, freelook, control, invalidate, get]);

  // Flight is continuous while a key is held, so it advances by the frame's own delta, not by
  // keydown repeats.
  useFrame((_, delta) => {
    if (!freelook.isActive) return;
    if (handle.isPreviewing(get().camera)) {
      exitPointerLock(gl.domElement);
      return;
    }
    const cursor = handle.cursor();
    const flown = freelook.fly(cursor, delta);
    if (flown !== cursor) handle.applyCursor(flown);
  });

  return control;
}
