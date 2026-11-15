/**
 * GraphEdit's two scrollbars, `h_scrollbar` and `v_scrollbar`: children of `top_layer` that the
 * constructor builds (`scene/gui/graph_edit.cpp:3210-3216`), sized and valued by
 * `_update_scrollbars` (`:463-510`) and anchored at `NOTIFICATION_READY` (`:840-851`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from '../../../../godot/math/rect2';
import {
  scrollBarMinimumSize,
  scrollBarRangePlacement,
  type ScrollBarPairBoxes,
  type ScrollBarPlacement,
} from '../shared/scrollBarSolver';
import type { GraphScrollBounds } from './minimap';
import type { Vector2 } from '../../../../godot/math/vector';
import { mirrorRectRtl } from '../../../../r3f/controls/native/controlRectSolver';

interface GraphEditScrollBars {
  horizontal: ScrollBarPlacement;
  vertical: ScrollBarPlacement;
}

/** The constructor's `set_min(-10000)` on both bars (`graph_edit.cpp:3218,3221`). */
const CONSTRUCTOR_SCROLL_MIN = -10000;
/** The constructor's `set_max(10000)` on both bars (`graph_edit.cpp:3219,3222`). */
const CONSTRUCTOR_SCROLL_MAX = 10000;

interface UpdatedScrollBarsInput {
  /** A child of a GraphElement class, hidden or not (`:296`, `:626-668`). */
  hasGraphElement: boolean;
  /** A setter queued `_update_scroll_offset` while the file loaded (`:409`, `:2448`). */
  queuedScrollOffsetUpdate: boolean;
  /** `get_size()` before the node was parented (`loadOrder.ts`). */
  outOfTreeSize: Vector2;
  /** The size the layout gave the GraphEdit. */
  solvedSize: Vector2;
}

/**
 * Whether `_update_scrollbars` (`:464-528`) has run by the first frame. It is the only writer of
 * the bar ranges, and a load reaches it through a GraphElement child, a queued scroll update, or
 * `NOTIFICATION_RESIZED` (`:868`), which a size that changed after the load sends.
 */
export function hasUpdatedScrollBars(input: UpdatedScrollBarsInput): boolean {
  return (
    input.hasGraphElement ||
    input.queuedScrollOffsetUpdate ||
    input.outOfTreeSize.x !== input.solvedSize.x ||
    input.outOfTreeSize.y !== input.solvedSize.y
  );
}

/**
 * The bars where nothing has called `_update_scrollbars` yet: the constructor's range with
 * `page` 0, and the full-length rects `NOTIFICATION_READY` anchors (`:841-852`). Both are
 * visible and overlap in the corner, and each grabber is its minimum size at the middle.
 */
export function graphEditConstructorScrollBars(
  graphEditSize: Vector2,
  boxes: ScrollBarPairBoxes
): GraphEditScrollBars {
  const hMin = scrollBarMinimumSize(false, boxes.horizontal);
  const vMin = scrollBarMinimumSize(true, boxes.vertical);
  const range = { min: CONSTRUCTOR_SCROLL_MIN, max: CONSTRUCTOR_SCROLL_MAX, page: 0 };
  const middle = ratioOf(0, range.min, range.max);
  return {
    horizontal: scrollBarRangePlacement(
      false,
      { x: 0, y: graphEditSize.y - hMin.y, w: graphEditSize.x, h: hMin.y },
      boxes.horizontal,
      range,
      middle,
      true
    ),
    vertical: scrollBarRangePlacement(
      true,
      { x: graphEditSize.x - vMin.x, y: 0, w: vMin.x, h: graphEditSize.y },
      boxes.vertical,
      range,
      middle,
      true
    ),
  };
}

/** `Range::get_as_ratio()`'s own CLAMP (`range.cpp:308-324`); neither bar is ever `exp_edit`. */
function ratioOf(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/**
 * Both bars, on every GraphEdit with a non-zero rect: `_update_scrollbars` grows the graph box by
 * one GraphEdit rect on each side (`:491-492`) while the page is that rect, so its only `hide()`
 * branch, `max - min <= page` (`:499,509`), never holds.
 */
export function graphEditScrollBars(
  graphEditSize: Vector2,
  bounds: GraphScrollBounds,
  scrollOffset: Vector2,
  boxes: ScrollBarPairBoxes
): GraphEditScrollBars {
  const hMin = scrollBarMinimumSize(false, boxes.horizontal);
  const vMin = scrollBarMinimumSize(true, boxes.vertical);

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

  return {
    horizontal: scrollBarRangePlacement(
      false,
      hRect,
      boxes.horizontal,
      { min: bounds.min.x, max: bounds.max.x, page: graphEditSize.x },
      ratioOf(scrollOffset.x, bounds.min.x, bounds.max.x),
      hVisible
    ),
    vertical: scrollBarRangePlacement(
      true,
      vRect,
      boxes.vertical,
      { min: bounds.min.y, max: bounds.max.y, page: graphEditSize.y },
      ratioOf(scrollOffset.y, bounds.min.y, bounds.max.y),
      vVisible
    ),
  };
}

/**
 * The bars of a right-to-left GraphEdit: `Control::_size_changed` mirrors each anchored bar inside
 * `top_layer` (`control.cpp:1785-1787`). A grabber keeps its place in its bar, since
 * `scroll_bar.cpp` never reads the layout direction.
 */
export function mirroredScrollBars(bars: GraphEditScrollBars, graphEditWidth: number): GraphEditScrollBars {
  return {
    horizontal: { ...bars.horizontal, rect: mirrorRectRtl(bars.horizontal.rect, graphEditWidth) },
    vertical: { ...bars.vertical, rect: mirrorRectRtl(bars.vertical.rect, graphEditWidth) },
  };
}
