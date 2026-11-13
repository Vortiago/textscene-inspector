/**
 * Shared HScrollBar/VScrollBar native geometry: `ScrollBar::get_minimum_size`, `get_area_size`,
 * `get_grabber_size`, `get_grabber_offset` and the draw rects (`scene/gui/scroll_bar.cpp`, Godot
 * 4.6.3), transposed for `vertical`. It takes `min`/`max` because `scrollcontainer/nativeSolver.ts`
 * calls it with `min` fixed at 0 for `ScrollContainer`'s embedded bars.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from '../../../../godot/math/rect2';
import { contentMarginSize, type StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { Vector2 } from '../../../../godot/math/vector';

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * One bar's `scroll` (track) and `grabber` StyleBoxes, as `scroll_bar.cpp`'s `theme_cache` reads them.
 * An HScrollBar and a VScrollBar each read their own type's items.
 */
export interface ScrollBarBoxes {
  scroll: StyleBoxFlatData;
  grabber: StyleBoxFlatData;
}

/** The boxes of a host's two internal bars. */
export interface ScrollBarPairBoxes {
  horizontal: ScrollBarBoxes;
  vertical: ScrollBarBoxes;
}

/** The grabber StyleBox's along-axis minimum: `get_grabber_min_size()` (`scroll_bar.cpp:473-477`). */
function grabberMinAlong(vertical: boolean, boxes: ScrollBarBoxes): number {
  const m = contentMarginSize(boxes.grabber);
  return vertical ? m.y : m.x;
}

/**
 * `ScrollBar::get_minimum_size` (`scroll_bar.cpp:519-548`) with every icon and padding term at 0.
 * The default theme sets all six `increment`/`decrement` icons to an empty `ImageTexture` on both
 * bars, so `native/themeIcons.ts` vendors none.
 */
export function scrollBarMinimumSize(vertical: boolean, boxes: ScrollBarBoxes): Vector2 {
  const track = contentMarginSize(boxes.scroll);
  const grabber = grabberMinAlong(vertical, boxes);
  if (vertical) {
    // minsize.width = MAX(incr.width, bg.minwidth); minsize.height = incr.height + decr.height + bg.minheight + grabber_min_size.
    return { x: Math.max(0, track.x), y: track.y + grabber };
  }
  // minsize.height = MAX(incr.height, bg.minheight); minsize.width = incr.width + decr.width + bg.minwidth + grabber_min_size.
  return { x: track.x + grabber, y: Math.max(0, track.y) };
}

/** The width of the vertical bar and the height of the horizontal one: the room a host reserves for each. */
export function scrollBarThicknesses(boxes: ScrollBarPairBoxes): {
  verticalWidth: number;
  horizontalHeight: number;
} {
  return {
    verticalWidth: scrollBarMinimumSize(true, boxes.vertical).x,
    horizontalHeight: scrollBarMinimumSize(false, boxes.horizontal).y,
  };
}

/** `ScrollBar::get_area_size` (`scroll_bar.cpp:491-513`): the grabber's travel along the bar. */
function scrollBarAreaSize(vertical: boolean, barLength: number, boxes: ScrollBarBoxes): number {
  const track = contentMarginSize(boxes.scroll);
  const trackAlong = vertical ? track.y : track.x;
  return barLength - trackAlong - grabberMinAlong(vertical, boxes);
}

/** One bar as its owner draws it: where it sits and where its grabber sits inside it. */
export interface ScrollBarPlacement {
  /** `ScrollBar::is_visible()`: the owner's own gate, such as `_update_scrollbars` (`scroll_container.cpp:592-593`). */
  visible: boolean;
  /** This bar's own rect, relative to its owner's top-left. */
  rect: Rect2;
  /** The grabber StyleBox's rect, relative to THIS bar's own top-left (`scroll_bar.cpp`'s `NOTIFICATION_DRAW`). */
  grabberRect: Rect2;
}

interface ScrollBarGrabberGeometry {
  /** Along-axis extent: `get_grabber_size()`. */
  size: number;
  /** Along-axis offset from the bar's top or left: `get_grabber_offset()`. */
  offset: number;
}

/**
 * `get_grabber_size`/`get_grabber_offset` (`scroll_bar.cpp:479-517`), fed a ratio that `rangeRatio`
 * resolved (`shared/range.ts`: `Range::get_as_ratio()`, `exp_edit` included).
 */
export function scrollBarGrabberGeometry(
  vertical: boolean,
  barLength: number,
  boxes: ScrollBarBoxes,
  min: number,
  max: number,
  page: number,
  ratio: number
): ScrollBarGrabberGeometry {
  const range = max - min;
  // scroll_bar.cpp:481-483: "if (range <= 0) return 0", a literal zero grabber size, not the
  // grabber's minimum-size floor.
  if (range <= 0) return { size: 0, offset: 0 };
  const areaSize = scrollBarAreaSize(vertical, barLength, boxes);
  // `Range::set_page`'s CLAMP (`range.cpp:254-256`) bounds the stored page to [0, range] before the
  // draw reads it, and `get_page() > 0 ? get_page() : 0` (`scroll_bar.cpp:485`) guards only a
  // negative. No setter chain runs here, so one clamp stands for both.
  const clampedPage = clamp(page, 0, range);
  const size = (clampedPage / range) * areaSize + grabberMinAlong(vertical, boxes);
  const offset = areaSize * ratio;
  return { size, offset };
}

/** One bar whose `Range` is `min` to `max` with the given `page`, its grabber at `ratio` of the range. */
export function scrollBarRangePlacement(
  vertical: boolean,
  rect: Rect2,
  boxes: ScrollBarBoxes,
  range: { min: number; max: number; page: number },
  ratio: number,
  visible: boolean
): ScrollBarPlacement {
  const length = vertical ? rect.h : rect.w;
  const grabber = scrollBarGrabberGeometry(vertical, length, boxes, range.min, range.max, range.page, ratio);
  return { visible, rect, grabberRect: scrollBarGrabberRect(vertical, { x: rect.w, y: rect.h }, grabber) };
}

/**
 * One bar of a scrolled content `range`: its `rect` and its grabber when the bar sits at `ratio` of
 * the range, a page long as the bar itself (`ScrollContainer` sets each bar's page to its length).
 */
export function scrollBarPlacement(
  vertical: boolean,
  rect: Rect2,
  boxes: ScrollBarBoxes,
  range: number,
  ratio: number,
  visible: boolean
): ScrollBarPlacement {
  const length = vertical ? rect.h : rect.w;
  return scrollBarRangePlacement(vertical, rect, boxes, { min: 0, max: range, page: length }, ratio, visible);
}

/**
 * The `scroll`/`scroll_focus` track rect, `Rect2(ofs, area)` (`scroll_bar.cpp:295-317`): with both
 * icon terms 0 it is the whole bar. `scene/gui/scroll_bar.cpp` never calls `is_layout_rtl()`, so
 * `Control::_size_changed` mirrors a standalone bar whole (`control.cpp:1785-1787`). The highlighted
 * states and `scroll_focus` need interaction, so a still frame never draws them.
 */
export function scrollBarTrackRect(size: Vector2): Rect2 {
  return { x: 0, y: 0, w: size.x, h: size.y };
}

/**
 * The `grabber` StyleBox rect (`scroll_bar.cpp:326-344`). `padding_*` is 0 (`scroll_bar.h`'s `ThemeCache`,
 * not in the table, per-node override not modelled), and the table's `scroll`
 * StyleBoxes pad only the cross axis, so the grabber starts
 * at its offset and spans the bar across.
 */
export function scrollBarGrabberRect(
  vertical: boolean,
  size: Vector2,
  grabber: ScrollBarGrabberGeometry
): Rect2 {
  if (vertical) {
    return { x: 0, y: grabber.offset, w: size.x, h: grabber.size };
  }
  return { x: grabber.offset, y: 0, w: grabber.size, h: size.y };
}

/**
 * `scroll_hint_vertical.svg`/`scroll_hint_horizontal.svg` (`scene/theme/icons/`) are 32x24 and
 * 24x32 at scale 1. Only the extent across each fade is read (`get_height()` at
 * `scroll_container.cpp:627,636`, `get_width()` at `:643,652`): the other axis is anchored.
 */
export const SCROLL_HINT_VERTICAL_HEIGHT = 24;
export const SCROLL_HINT_HORIZONTAL_WIDTH = 24;

/** One `scroll_hint_*` TextureRect that `_update_scroll_hints` left visible. */
export interface ScrollHintPlacement {
  /** This hint's rect relative to the ScrollContainer's own top-left, as the anchors compute it. A vertical hint is twice the container wide (`scroll_container.cpp:625`), cut back by the clip. */
  rect: Rect2;
  /** `true` for the `scroll_hint_vertical` icon (the fade runs down the rect), `false` for `scroll_hint_horizontal`. */
  vertical: boolean;
  flipH: boolean;
  flipV: boolean;
}
