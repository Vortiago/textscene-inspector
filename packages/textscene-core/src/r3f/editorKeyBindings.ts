/**
 * The keyboard half of viewport navigation: Godot's numpad view snaps and
 * projection toggle, plus the WASDQE codes freelook flight reads.
 */

import type { EditorControlsHandle } from './EditorControlsHandle.js';
import {
  viewSnapCursor,
  OPPOSITE_VIEW,
  type FreelookKeys,
  type GodotViewAngle,
} from './godotEditorCursor.js';

/** Numpad view snaps. Ctrl inverts each to the opposite face. */
const VIEW_SNAP_KEYS: Readonly<Record<string, GodotViewAngle>> = {
  Numpad1: 'front',
  Numpad3: 'right',
  Numpad7: 'top',
};

/** `event.code` → which freelook direction it drives. */
export const FREELOOK_KEYS: Readonly<Record<string, keyof FreelookKeys>> = {
  KeyW: 'forward',
  KeyS: 'back',
  KeyA: 'left',
  KeyD: 'right',
  KeyQ: 'down',
  KeyE: 'up',
};

/**
 * Numpad 1/3/7 (+ Ctrl for the opposite face) and Numpad 5. Returns whether the
 * view moved, so the caller owns the single `invalidate()`.
 */
export function applyEditorViewKey(
  event: KeyboardEvent,
  handle: EditorControlsHandle
): boolean {
  const view = VIEW_SNAP_KEYS[event.code];
  if (view) {
    // Without NumLock the numpad emits End/PageUp/…, which scroll the page.
    event.preventDefault();
    handle.applyCursor(
      viewSnapCursor(handle.cursor(), event.ctrlKey ? OPPOSITE_VIEW[view] : view)
    );
    return true;
  }
  if (event.code === 'Numpad5') {
    event.preventDefault();
    handle.toggleProjection();
    return true;
  }
  return false;
}

/** The directions a set of held key codes asks freelook flight to move in. */
export function freelookKeysFrom(held: ReadonlySet<string>, sprint: boolean): FreelookKeys {
  const keys: FreelookKeys = { sprint };
  for (const code of held) {
    const direction = FREELOOK_KEYS[code];
    if (direction) keys[direction] = true;
  }
  return keys;
}
