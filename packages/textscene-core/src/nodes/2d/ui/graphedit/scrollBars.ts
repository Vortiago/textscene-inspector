/**
 * GraphEdit's own two scrollbars — `h_scrollbar`/`v_scrollbar`, constructor-
 * built children of `top_layer` (`scene/gui/graph_edit.cpp:3210-3216`), sized
 * and valued by `_update_scrollbars` (`:463-510`) and anchored by
 * `_notification(NOTIFICATION_READY)` (`:840-851`).
 *
 * Both are visible in every GraphEdit with a non-zero rect: the range
 * `_update_scrollbars` builds is the graph box grown by one whole GraphEdit
 * rect on each side (`:491-492`), while the page is that rect, so
 * `max - min <= page` — the only `hide()` branch (`:499,509`) — cannot hold.
 *
 * Pure data + functions, no React, no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import { scrollBarGrabberGeometry, scrollBarGrabberRect, scrollBarMinimumSize } from '../shared/scrollBarSolver';
import type { GraphScrollBounds } from './minimap';

export interface GraphEditScrollBar {
  visible: boolean;
  /** The bar's own rect in GraphEdit's local space. */
  rect: Rect2;
  /** The grabber's rect, relative to the bar's own origin. */
  grabberRect: Rect2;
}

export interface GraphEditScrollBars {
  horizontal: GraphEditScrollBar;
  vertical: GraphEditScrollBar;
}

/** `Range::get_as_ratio()`'s own CLAMP (`range.cpp:308-324`); neither bar is ever `exp_edit`. */
function ratioOf(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

export function graphEditScrollBars(
  graphEditSize: Vec2,
  bounds: GraphScrollBounds,
  scrollOffset: Vec2,
  theme: NativeTheme
): GraphEditScrollBars {
  const hMin = scrollBarMinimumSize(false, theme);
  const vMin = scrollBarMinimumSize(true, theme);

  const hVisible = bounds.max.x - bounds.min.x > graphEditSize.x;
  const vVisible = bounds.max.y - bounds.min.y > graphEditSize.y;

  const hRect: Rect2 = {
    x: 0,
    y: graphEditSize.y - hMin.y,
    w: graphEditSize.x - (vVisible ? vMin.x : 0),
    h: hMin.y,
  };
  const vRect: Rect2 = {
    x: graphEditSize.x - vMin.x,
    y: 0,
    w: vMin.x,
    h: graphEditSize.y - (hVisible ? hMin.y : 0),
  };

  const hGrabber = scrollBarGrabberGeometry(
    false,
    hRect.w,
    theme,
    bounds.min.x,
    bounds.max.x,
    graphEditSize.x,
    ratioOf(scrollOffset.x, bounds.min.x, bounds.max.x)
  );
  const vGrabber = scrollBarGrabberGeometry(
    true,
    vRect.h,
    theme,
    bounds.min.y,
    bounds.max.y,
    graphEditSize.y,
    ratioOf(scrollOffset.y, bounds.min.y, bounds.max.y)
  );

  return {
    horizontal: {
      visible: hVisible,
      rect: hRect,
      grabberRect: scrollBarGrabberRect(false, { x: hRect.w, y: hRect.h }, hGrabber),
    },
    vertical: {
      visible: vVisible,
      rect: vRect,
      grabberRect: scrollBarGrabberRect(true, { x: vRect.w, y: vRect.h }, vGrabber),
    },
  };
}
