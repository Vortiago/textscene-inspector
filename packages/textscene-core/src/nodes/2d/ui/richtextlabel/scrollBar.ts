/**
 * RichTextLabel's vertical scrollbar: it shows when `scroll_active` holds and the text is taller
 * than the rect, and the text then wraps beside it (`_update_scroll_exceeds`,
 * `scene/gui/rich_text_label.cpp:3801-3830`). The bar sits at the top, or at the foot of the text
 * under `scroll_following`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import {
  scrollBarGrabberGeometry,
  scrollBarGrabberRect,
  scrollBarMinimumSize,
  type ScrollBarPlacement,
} from '../shared/scrollBarSolver';
import { richTextContentHeightPx, type RichTextLayout, type StyledTextRun } from './nativeSolver';

/** The text shaped at one wrap width. */
interface RichTextShape {
  runs: StyledTextRun[];
  layout: RichTextLayout;
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
  if (!box.scrollActive || richTextContentHeightPx(full.runs, full.layout) <= box.h) {
    return { ...full, wrapWidthPx: box.w, textOriginXPx: 0, scrollOffsetPx: 0, scrollBar: null };
  }
  const { x: barWidthPx } = scrollBarMinimumSize(true, theme);
  const wrapWidthPx = box.w - barWidthPx;
  const beside = shapeAt(wrapWidthPx);
  const contentHeightPx = richTextContentHeightPx(beside.runs, beside.layout);
  // `set_value(total_height)` (`:3827-3828`), which `Range` clamps to `max - page`, then to `min`
  // (`range.cpp:192-196`). A `%` image narrows beside the bar, so the text there can be shorter than the rect.
  const scrollOffsetPx = box.scrollFollowing ? Math.max(0, contentHeightPx - box.h) : 0;
  return {
    ...beside,
    wrapWidthPx,
    textOriginXPx: box.rtl ? barWidthPx : 0,
    scrollOffsetPx,
    scrollBar: scrollBarPlacement(box, contentHeightPx, scrollOffsetPx, barWidthPx, theme),
  };
}
