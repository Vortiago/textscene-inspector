/**
 * RichTextLabel's vertical scrollbar: it shows when `scroll_active` holds and the text is taller
 * than the rect, and the text then wraps beside it (`_update_scroll_exceeds`,
 * `scene/gui/rich_text_label.cpp:3801-3830`). Only the top of the text is in frame, so the bar
 * scrolls only to the foot (`scroll_following`) or to where `scroll_following_visible_characters` leaves it.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import {
  scrollBarGrabberGeometry,
  scrollBarGrabberRect,
  scrollBarMinimumSize,
  type ScrollBarBoxes,
  type ScrollBarPlacement,
} from '../shared/scrollBarSolver';
import { RANGE_DEFAULT_MAX, clampRangeValue } from '../shared/range';
import { richTextContentHeightPx, type RichTextLayout, type StyledTextRun } from './nativeSolver';

/** The text shaped at one wrap width. */
interface RichTextShape {
  runs: StyledTextRun[];
  layout: RichTextLayout;
}

interface RichTextShapeBesideScrollBar extends RichTextShape {
  /** The width the text wrapped at: the rect's, less the bar's when it shows. */
  wrapWidthPx: number;
  /** The height of the text at that width. */
  contentHeightPx: number;
  /** Where the lines begin: after the bar when an RTL layout mirrors it to the left. */
  textOriginXPx: number;
  /** How far the scroll value has moved the text up. */
  scrollOffsetPx: number;
  /** The bar in the label's own space, or `null` where Godot hides it. */
  scrollBar: ScrollBarPlacement | null;
}

/** The label the text wraps in: its rect, its scroll properties and its layout direction. */
interface RichTextBox {
  w: number;
  h: number;
  scrollActive: boolean;
  scrollFollowing: boolean;
  scrollFollowingVisibleCharacters: boolean;
  rtl: boolean;
}

/**
 * The bar's placement for text `contentHeightPx` tall. Anchored to the right edge and the full
 * height (`:2370-2373`, `:8211-8213`), which an RTL layout mirrors to the left
 * (`control.cpp:1785-1787`). Its range is the text height and its page the rect height
 * (`:3825-3826`), at the value `scrollOffsetPx` names.
 */
function scrollBarPlacement(
  box: RichTextBox,
  contentHeightPx: number,
  scrollOffsetPx: number,
  widthPx: number,
  boxes: ScrollBarBoxes
): ScrollBarPlacement {
  const size = { x: widthPx, y: box.h };
  const ratio = scrollOffsetPx / contentHeightPx;
  const grabber = scrollBarGrabberGeometry(true, size.y, boxes, 0, contentHeightPx, box.h, ratio);
  return {
    visible: true,
    rect: { x: box.rtl ? 0 : box.w - widthPx, y: 0, w: size.x, h: size.y },
    grabberRect: scrollBarGrabberRect(true, size, grabber),
  };
}

/**
 * The scroll value: the foot for `scroll_following`, which wins (`:3827-3828`), else where
 * `scroll_following_visible_characters` leaves it, else the top. `_update_follow_vc` (`:5209-5221`)
 * runs before any line is shaped, so it scrolls to the bar's default max, which `Range` clamps to the foot.
 */
function scrollOffsetOf(box: RichTextBox, contentHeightPx: number): number {
  const footPx = clampRangeValue(contentHeightPx, 0, contentHeightPx, box.h);
  if (box.scrollFollowing) return footPx;
  return box.scrollFollowingVisibleCharacters ? Math.min(RANGE_DEFAULT_MAX, footPx) : 0;
}

/**
 * Shapes the text at the rect's width, and again beside the bar when it is taller than the rect
 * (`:3805`). `shapeAt` takes the wrap width, since a `%` image reads it too (`_resize_line`,
 * `:503`). Godot compares against the control's height, `get_size().height` (`:3866`).
 */
export function shapeBesideScrollBar(
  shapeAt: (wrapWidthPx: number) => RichTextShape,
  box: RichTextBox,
  /** The boxes of the `VScrollBar` the label creates inside itself (`rich_text_label.cpp:8207`). */
  boxes: ScrollBarBoxes
): RichTextShapeBesideScrollBar {
  const full = shapeAt(box.w);
  const fullHeightPx = richTextContentHeightPx(full.runs, full.layout);
  // `_notification` shows the bar of a label that follows its visible characters, even one that fits (`:2659-2667`).
  const showsBar = box.scrollActive && (box.scrollFollowingVisibleCharacters || fullHeightPx > box.h);
  if (!showsBar) {
    // The value moves whether or not the bar shows (`:3827-3830`).
    return {
      ...full,
      wrapWidthPx: box.w,
      contentHeightPx: fullHeightPx,
      textOriginXPx: 0,
      scrollOffsetPx: scrollOffsetOf(box, fullHeightPx),
      scrollBar: null,
    };
  }
  const { x: barWidthPx } = scrollBarMinimumSize(true, boxes);
  const wrapWidthPx = box.w - barWidthPx;
  const beside = shapeAt(wrapWidthPx);
  const contentHeightPx = richTextContentHeightPx(beside.runs, beside.layout);
  // `set_value(total_height)` (`:3827-3828`). A `%` image narrows beside the bar, so the text there
  // can be shorter than the rect, and `Range` holds the value at 0 (`range.cpp:192-196`).
  const scrollOffsetPx = scrollOffsetOf(box, contentHeightPx);
  return {
    ...beside,
    wrapWidthPx,
    contentHeightPx,
    textOriginXPx: box.rtl ? barWidthPx : 0,
    scrollOffsetPx,
    scrollBar: scrollBarPlacement(box, contentHeightPx, scrollOffsetPx, barWidthPx, boxes),
  };
}
