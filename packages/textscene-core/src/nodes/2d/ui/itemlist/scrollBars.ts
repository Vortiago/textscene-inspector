/**
 * Where an ItemList places its two scrollbars and its bottom scroll hint: the anchors of
 * `NOTIFICATION_DRAW` (`scene/gui/item_list.cpp:1370-1379`) and the hint draw (`:1708-1720`). A
 * `.tscn` stores no scroll value, so every grabber sits at value 0 and the top hint never shows.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Rect2 } from '../../../../godot/math/rect2';
import type { Vector2 } from '../../../../godot/math/vector';
import { ItemListScrollHintMode } from '../../../../godot/scene/gui';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import {
  SCROLL_HINT_VERTICAL_HEIGHT,
  scrollBarGrabberGeometry,
  scrollBarGrabberRect,
  type ScrollBarBoxes,
  type ScrollBarPairBoxes,
  type ScrollBarPlacement,
  type ScrollHintPlacement,
} from '../shared/scrollBarSolver';
import { itemListBarMinimums, itemListMirrorX, type ItemListScrollRange } from './nativeSolver';

interface ItemListScrollBarsInput {
  /** The control's `get_size()`. */
  size: Vector2;
  /** The panel StyleBox's content margins. */
  margins: StyleBoxFlatData['contentMargin'];
  vertical: ItemListScrollRange;
  horizontal: ItemListScrollRange;
  rtl: boolean;
  boxes: ScrollBarPairBoxes;
  scrollHintMode: number;
}

interface ItemListScrollBars {
  vertical: ScrollBarPlacement;
  horizontal: ScrollBarPlacement;
  /** `null` where the hint is not drawn. */
  bottomHint: ScrollHintPlacement | null;
}

/** Range::get_as_ratio at value 0 (`range.cpp:308-324`): 0 for a range from 0, 1 at the far end of a mirrored one. */
function ratioAtZero(range: ItemListScrollRange): number {
  const span = range.max - range.min;
  if (span === 0) return 1;
  return Math.min(1, Math.max(0, -range.min / span));
}

function placement(
  vertical: boolean,
  rect: Rect2,
  range: ItemListScrollRange,
  boxes: ScrollBarBoxes
): ScrollBarPlacement {
  const length = vertical ? rect.h : rect.w;
  const grabber = scrollBarGrabberGeometry(
    vertical,
    length,
    boxes,
    range.min,
    range.max,
    range.page,
    ratioAtZero(range)
  );
  return {
    visible: range.visible,
    rect,
    grabberRect: scrollBarGrabberRect(vertical, { x: rect.w, y: rect.h }, grabber),
  };
}

/**
 * The bottom hint shows from value 0 when the content runs more than 1 px past the page
 * (`v_scroll_below_max`, `item_list.cpp:1710`), in mode BOTH or BOTTOM (`:1717`).
 */
function bottomHintPlacement(
  size: Vector2,
  vertical: ItemListScrollRange,
  scrollHintMode: number
): ScrollHintPlacement | null {
  const isBottomMode =
    scrollHintMode === ItemListScrollHintMode.SCROLL_HINT_MODE_BOTH ||
    scrollHintMode === ItemListScrollHintMode.SCROLL_HINT_MODE_BOTTOM;
  if (!isBottomMode || vertical.max - vertical.page - 1 <= 0) return null;
  // A negative rect height flips the texture (`:1718`).
  return {
    rect: { x: 0, y: size.y - SCROLL_HINT_VERTICAL_HEIGHT, w: size.x, h: SCROLL_HINT_VERTICAL_HEIGHT },
    vertical: true,
    flipH: false,
    flipV: true,
  };
}

export function itemListScrollBars(input: ItemListScrollBarsInput): ItemListScrollBars {
  const { size, margins, rtl, boxes } = input;
  const minimums = itemListBarMinimums(boxes);
  const verticalWidth = input.vertical.visible ? minimums.verticalWidth : 0;
  const horizontalHeight = input.horizontal.visible ? minimums.horizontalHeight : 0;

  // Left-to-right anchors (`:1373-1379`). The margins swap under RTL (`:1368-1369`), then each
  // bar's rect mirrors whole, since `Control::_size_changed` mirrors an anchored child (`control.cpp:1785-1787`).
  const leftMargin = rtl ? margins.right : margins.left;
  const rightMargin = rtl ? margins.left : margins.right;

  const verticalRect: Rect2 = {
    x: itemListMirrorX(size.x - verticalWidth - rightMargin, verticalWidth, size.x, rtl),
    y: margins.top,
    w: verticalWidth,
    h: size.y - horizontalHeight - margins.bottom - margins.top,
  };
  const horizontalWidth = size.x - rightMargin - verticalWidth - leftMargin;
  const horizontalRect: Rect2 = {
    x: itemListMirrorX(leftMargin, horizontalWidth, size.x, rtl),
    y: size.y - horizontalHeight - margins.bottom,
    w: horizontalWidth,
    h: horizontalHeight,
  };

  return {
    vertical: placement(true, verticalRect, input.vertical, boxes.vertical),
    horizontal: placement(false, horizontalRect, input.horizontal, boxes.horizontal),
    bottomHint: bottomHintPlacement(size, input.vertical, input.scrollHintMode),
  };
}
