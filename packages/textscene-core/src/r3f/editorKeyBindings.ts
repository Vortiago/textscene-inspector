/**
 * The keyboard half of viewport navigation: Godot's numpad view snaps and
 * projection toggle, the freelook toggle and the key codes freelook flight reads.
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

export type FreelookDirection = Exclude<keyof FreelookKeys, 'sprint' | 'slow'>;

/**
 * `spatial_editor/freelook_*` (`node_3d_editor_plugin.cpp:6100-6105`): Godot registers each as a
 * physical key, which `event.code` is, so the keys keep their places on every layout.
 */
const GODOT_FREELOOK_KEYS: Readonly<Record<string, FreelookDirection>> = {
  KeyW: 'forward',
  KeyS: 'back',
  KeyA: 'left',
  KeyD: 'right',
  KeyQ: 'down',
  KeyE: 'up',
};

/**
 * The previewer's own flight keys, a departure from Godot (ADR-0029). Godot's viewport binds no
 * arrow key, and its Space maximises the viewport, which the previewer cannot do. No Ctrl key
 * flies: held with W it is the chord that closes a browser tab, which no page can prevent.
 */
const PREVIEWER_FREELOOK_KEYS: Readonly<Record<string, FreelookDirection>> = {
  ArrowUp: 'forward',
  ArrowDown: 'back',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Space: 'up',
};

/** The direction a key code flies in, or undefined for a key that flies nowhere. */
export function freelookDirectionOf(code: string): FreelookDirection | undefined {
  return GODOT_FREELOOK_KEYS[code] ?? PREVIEWER_FREELOOK_KEYS[code];
}

/** `spatial_editor/freelook_toggle`: Shift+F and no other modifier (`node_3d_editor_plugin.cpp:9962`). */
export function isFreelookToggleKey(event: KeyboardEvent): boolean {
  return (
    event.key.toLowerCase() === 'f' && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey
  );
}

/**
 * Consumes a numpad view key, so it scrolls no page: without NumLock the numpad emits
 * End/PageUp/…. Returns whether `event` is one.
 */
export function consumeEditorViewKey(event: KeyboardEvent): boolean {
  const isViewKey = event.code in VIEW_SNAP_KEYS || event.code === 'Numpad5';
  if (isViewKey) event.preventDefault();
  return isViewKey;
}

/**
 * Numpad 1/3/7 (+ Ctrl for the opposite face) and Numpad 5. Returns whether the
 * view moved, so the caller owns the single `invalidate()`.
 */
export function applyEditorViewKey(event: KeyboardEvent, handle: EditorControlsHandle): boolean {
  if (!consumeEditorViewKey(event)) return false;
  const view = VIEW_SNAP_KEYS[event.code];
  if (view) {
    handle.applyCursor(viewSnapCursor(handle.cursor(), event.ctrlKey ? OPPOSITE_VIEW[view] : view));
  } else {
    handle.toggleProjection();
  }
  return true;
}
