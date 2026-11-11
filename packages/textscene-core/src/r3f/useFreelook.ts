/**
 * Freelook's own inputs for one canvas: the Shift+F toggle and its pointer lock, the flight keys,
 * the mouse look of the toggle, and the flight per frame. The right-drag that holds freelook on
 * is a pointer gesture, so it stays in `useEditorNavigation.ts`.
 */
import { useFrame, type RootState } from '@react-three/fiber';
import { useEffect } from 'react';
import type { EditorControlsHandle } from './EditorControlsHandle.js';
import { isFreelookToggleKey } from './editorKeyBindings.js';
import type { Freelook, FreelookControl } from './freelook.js';
import { freelookCursor } from './godotEditorCursor.js';
import { isTypingTarget } from './hooks/isTypingTarget.js';
import { exitPointerLock, holdsPointerLock, requestPointerLock } from './pointerLock.js';

/** A lone Alt keyup opens the menu bar on Windows and Linux, which would take the keyboard mid-flight. */
function isAltKey(code: string): boolean {
  return code === 'AltLeft' || code === 'AltRight';
}

/** Starts the toggle of a canvas's freelook, or ends it. It does nothing where Godot has no freelook. */
function toggleFreelook(handle: EditorControlsHandle, get: RootState['get']): void {
  const state = get();
  const element = state.gl.domElement;
  if (handle.freelook.isToggled) {
    exitPointerLock(element);
    return;
  }
  if (!handle.canFreelook(state.camera)) return;
  // Focus leaves the control that started the toggle: Space would press a focused button.
  element.tabIndex = -1;
  element.focus({ preventScroll: true });
  requestPointerLock(element);
}

/** What the shell outside the `<Canvas>` holds of a canvas's freelook. */
export function freelookControlOf(handle: EditorControlsHandle, get: RootState['get']): FreelookControl {
  return {
    toggle: () => toggleFreelook(handle, get),
    getState: handle.freelook.getState,
    subscribe: handle.freelook.subscribe,
  };
}

function handleKeyDown(event: KeyboardEvent, handle: EditorControlsHandle, get: RootState['get']): void {
  if (isTypingTarget(event.target)) return;
  const freelook = handle.freelook;
  // Godot accepts every key event while freelook is on (`node_3d_editor_plugin.cpp:2768-2772`),
  // so no other shortcut of the page hears a key.
  if (freelook.isActive) event.stopImmediatePropagation();
  if (isFreelookToggleKey(event)) {
    event.preventDefault();
    if (!event.repeat) toggleFreelook(handle, get);
    return;
  }
  if (!freelook.isActive) return;
  freelook.readModifiers(event);
  if (event.code === 'Escape') {
    exitPointerLock(get().gl.domElement);
    return;
  }
  // A flight key under Ctrl or Meta is a chord of the page or the browser. macOS sends no keyup
  // for a key released under Meta, so a key pressed there would fly on with nothing held.
  if (event.ctrlKey || event.metaKey) return;
  if (freelook.pressKey(event.code) || isAltKey(event.code)) event.preventDefault();
}

function handleKeyUp(event: KeyboardEvent, freelook: Freelook): void {
  if (!freelook.isActive) return;
  freelook.readModifiers(event);
  freelook.releaseKey(event.code);
  if (isAltKey(event.code)) event.preventDefault();
}

export function useFreelook(
  gl: RootState['gl'],
  handle: EditorControlsHandle,
  invalidate: RootState['invalidate'],
  get: RootState['get']
): void {
  useEffect(() => {
    const element = gl.domElement;
    const lockDocument = element.ownerDocument;
    const freelook = handle.freelook;

    function setToggled(isToggled: boolean): void {
      freelook.setToggled(isToggled);
      // A locked pointer has no position to pick at, so the canvas neither selects nor hovers.
      get().setEvents({ enabled: !isToggled });
    }

    // The lock is the toggle: the browser ends it on Escape and on a focus change by its own
    // rules, so this one event is where the toggle starts and ends.
    const handlePointerLockChange = (): void => setToggled(holdsPointerLock(element));

    function handlePointerMove(event: PointerEvent): void {
      if (!freelook.isToggled || !handle.canFreelook(get().camera)) return;
      if (event.movementX === 0 && event.movementY === 0) return;
      handle.applyCursor(freelookCursor(handle.cursor(), event.movementX, event.movementY));
      invalidate();
    }

    // Godot ends freelook when its window loses focus (`node_3d_editor_plugin.cpp:3579-3581`).
    // A key held then sends no keyup, so the held keys go too.
    function handleFocusLoss(): void {
      freelook.releaseKeys();
      exitPointerLock(element);
    }

    const onKeyDown = (event: KeyboardEvent): void => handleKeyDown(event, handle, get);
    const onKeyUp = (event: KeyboardEvent): void => handleKeyUp(event, freelook);

    lockDocument.addEventListener('pointerlockchange', handlePointerLockChange);
    lockDocument.addEventListener('visibilitychange', handleFocusLoss);
    element.addEventListener('pointermove', handlePointerMove);
    // Capture, so these run before every other shortcut's listener on `window`.
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('blur', handleFocusLoss);

    return () => {
      lockDocument.removeEventListener('pointerlockchange', handlePointerLockChange);
      lockDocument.removeEventListener('visibilitychange', handleFocusLoss);
      element.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      window.removeEventListener('blur', handleFocusLoss);
      exitPointerLock(element);
      setToggled(false);
    };
  }, [gl, handle, invalidate, get]);

  // Flight is continuous while a key is held, so it advances by the frame's own delta, not by
  // keydown repeats.
  useFrame((_, delta) => {
    const freelook = handle.freelook;
    if (!freelook.isActive) return;
    // A camera preview that starts mid-flight ends the toggle.
    if (!handle.canFreelook(get().camera)) {
      exitPointerLock(gl.domElement);
      return;
    }
    if (freelook.isFlying) handle.applyCursor(freelook.fly(handle.cursor(), delta));
  });
}
