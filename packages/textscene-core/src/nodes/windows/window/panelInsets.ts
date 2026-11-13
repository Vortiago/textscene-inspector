/**
 * The internal Panel of a popup window: its offsets from the window's edges, which make room for the
 * shadow of its StyleBoxFlat (`PopupPanel::_update_shadow_offsets`, `popup.cpp:315-344`, and
 * `PopupMenu::_update_shadow_offsets`, `popup_menu.cpp:3377-3399`). Pure: no React, no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from '../../../godot/math/rect2';
import type { Vector2 } from '../../../godot/math/vector';
import type { ResolvedStyleBox } from '../../../r3f/controls/native/parseStyleBox';

/** The Panel's offsets from the window's edges: the right and bottom ones are zero or less. */
export interface PanelInsets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const NO_INSETS: PanelInsets = { left: 0, top: 0, right: 0, bottom: 0 };

/** The insets for an embedded, visible popup. Only a `StyleBoxFlat` casts a shadow there, so a line or texture box insets nothing. */
export function shadowInsets(style: ResolvedStyleBox, rtl: boolean): PanelInsets {
  if ('styleBoxKind' in style || style.shadowSize === 0) return NO_INSETS;
  const size = style.shadowSize;
  const offset = style.shadowOffset;
  const horizontal = rtl ? offset.x : -offset.x;
  return {
    left: Math.max(0, size + horizontal),
    top: Math.max(0, size - offset.y),
    right: Math.min(0, -size + horizontal),
    bottom: Math.min(0, -size - offset.y),
  };
}

/** The space the shadow insets take from the window, per axis. */
export function insetSize(insets: PanelInsets): Vector2 {
  return { x: insets.left - insets.right, y: insets.top - insets.bottom };
}

/** The Panel's rect in a window of `size`: the window less the insets. A right-to-left layout mirrors it (`control.cpp:1785-1787`). */
export function panelRect(insets: PanelInsets, isRtl: boolean, size: Vector2): Rect2 {
  const shadow = insetSize(insets);
  return {
    x: isRtl ? -insets.right : insets.left,
    y: insets.top,
    w: size.x - shadow.x,
    h: size.y - shadow.y,
  };
}
