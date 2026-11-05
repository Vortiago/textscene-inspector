/**
 * The order an embedder draws its windows in, and the one with focus. Each visible window registers
 * as it enters the tree (`Viewport::_sub_window_register`, `scene/main/viewport.cpp:308-341`): it goes
 * last, takes focus unless `unfocusable`, and the always-on-top pass reorders the list
 * (`_sub_window_update_order`, `:269-302`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { boolSlotValue } from '../../../godot/variant/variantBool';
import type { ProjectSettings } from '../../../parser/projectSettingsParser';

/** `display/window/subwindows/embed_subwindows`, which `main/main.cpp` hands the root window. */
const EMBED_SUBWINDOWS_SETTING = 'display/window/subwindows/embed_subwindows';

/** Whether the root window embeds its windows. It does by default (`project_settings.cpp:1756`). */
export function rootEmbedsSubwindows(settings: ProjectSettings | null): boolean {
  return boolSlotValue(settings?.[EMBED_SUBWINDOWS_SETTING]) !== false;
}

/** A window as the stack reads it. `parent` is its nearest visible ancestor window in the stack. */
export interface StackedWindow {
  unfocusable: boolean;
  alwaysOnTop: boolean;
  exclusive: boolean;
  parent: StackedWindow | null;
}

export interface SubwindowStack<T extends StackedWindow> {
  /** Back to front. */
  order: T[];
  /** The window `gui.subwindow_focused` names, or `null` when none took focus. */
  focused: T | null;
}

/** Whether the always-on-top pass moves `window` to the front group (`:279-281`). */
function staysOnTop(window: StackedWindow): boolean {
  return window.alwaysOnTop || (window.parent?.alwaysOnTop === true && window.exclusive);
}

/**
 * `windows` in registration order: the tree's pre-order, a parent before the windows below it.
 * Registration only appends, so the stack is the always-on-top pass over that order, which keeps each
 * group's order. The exclusive-child pass moves a child above its parent, where pre-order already
 * puts it.
 */
export function subwindowStack<T extends StackedWindow>(windows: readonly T[]): SubwindowStack<T> {
  const below = windows.filter((window) => !staysOnTop(window));
  const onTop = windows.filter(staysOnTop);
  return { order: [...below, ...onTop], focused: lastFocusable(windows) };
}

function lastFocusable<T extends StackedWindow>(windows: readonly T[]): T | null {
  for (let i = windows.length - 1; i >= 0; i--) if (!windows[i]!.unfocusable) return windows[i]!;
  return null;
}
