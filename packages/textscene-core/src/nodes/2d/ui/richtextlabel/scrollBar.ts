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

import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import {
  scrollBarGrabberGeometry,
  scrollBarGrabberRect,
  scrollBarMinimumSize,
  type ScrollBarPlacement,
} from '../shared/scrollBarSolver';
import { RANGE_DEFAULT_MAX } from '../shared/range';
import { richTextContentHeightPx, type StyledTextRun } from './nativeSolver';

/** The text shaped at one wrap width. */
interface RichTextShape {
  runs: StyledTextRun[];
  layout: TextLayoutResult;
  /** What draws, when it is not `layout`: the shaped prefix of Before Shaping (`rich_text_label.cpp:668-671`). `layout` still sizes the text and its bar. */
  shown?: { runs: StyledTextRun[]; layout: TextLayoutResult };
}

interface RichTextShapeBesideScrollBar extends RichTextShape {
  /** The width the text wrapped at: the rect's, less the bar's when it shows. */
  wrapWidthPx: number;
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
  theme: NativeTheme
): ScrollBarPlacement {
  const size = { x: widthPx, y: box.h };
  const ratio = scrollOffsetPx / contentHeightPx;
  const grabber = scrollBarGrabberGeometry(true, size.y, theme, 0, contentHeightPx, box.h, ratio);
  return {
    visible: true,
    rect: { x: box.rtl ? 0 : box.w - widthPx, y: 0, w: size.x, h: size.y },
    grabberRect: scrollBarGrabberRect(true, size, grabber),
  };
}

/**
 * Where `scroll_following_visible_characters` leaves the scroll value. `_update_follow_vc`
 * (`:5209-5221`) runs as the scene loads, before any line is shaped, so `get_line_count()` is 0 and
 * it scrolls to the bar's default max (`:5218`). `Range` then clamps it to `max - page` when the
 * text is shaped (`range.cpp:192-194`).
 */
function followedVisibleCharactersOffsetPx(contentHeightPx: number, boxHeightPx: number): number {
  return Math.min(RANGE_DEFAULT_MAX, Math.max(0, contentHeightPx - boxHeightPx));
}

/** The scroll value: the foot for `scroll_following`, which wins (`:3827-3828`), else the followed position, else the top. */
function scrollOffsetOf(box: RichTextBox, contentHeightPx: number): number {
  if (box.scrollFollowing) return Math.max(0, contentHeightPx - box.h);
  if (box.scrollFollowingVisibleCharacters) return followedVisibleCharactersOffsetPx(contentHeightPx, box.h);
  return 0;
}

/**
 * Shapes the text at the rect's width, and again beside the bar when it is taller than the rect
 * (`:3805`). `shapeAt` takes the wrap width, since a `%` image reads it too (`_resize_line`,
 * `:503`). Godot compares against the control's height, `get_size().height` (`:3866`).
 */
export function shapeBesideScrollBar(
  shapeAt: (wrapWidthPx: number) => RichTextShape,
  box: RichTextBox,
  theme: NativeTheme
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
      textOriginXPx: 0,
      scrollOffsetPx: scrollOffsetOf(box, fullHeightPx),
      scrollBar: null,
    };
  }
  const { x: barWidthPx } = scrollBarMinimumSize(true, theme);
  const wrapWidthPx = box.w - barWidthPx;
  const beside = shapeAt(wrapWidthPx);
  const contentHeightPx = richTextContentHeightPx(beside.runs, beside.layout);
  // `set_value(total_height)` (`:3827-3828`), which `Range` clamps to `max - page` (`range.cpp:192-194`).
  const scrollOffsetPx = scrollOffsetOf(box, contentHeightPx);
  return {
    ...beside,
    wrapWidthPx,
    textOriginXPx: box.rtl ? barWidthPx : 0,
    scrollOffsetPx,
    scrollBar: scrollBarPlacement(box, contentHeightPx, scrollOffsetPx, barWidthPx, theme),
  };
}
