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

import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** This axis' track StyleBox: `scroll_style` (`scroll_bar.cpp`'s `theme_cache.scroll_style`). */
function trackStyleBox(vertical: boolean, theme: NativeTheme) {
  return vertical ? theme.widgets.scrollBar.scrollVertical : theme.widgets.scrollBar.scrollHorizontal;
}

/** The grabber StyleBox's along-axis minimum: `get_grabber_min_size()` (`scroll_bar.cpp:473-477`). */
function grabberMinAlong(vertical: boolean, theme: NativeTheme): number {
  const m = contentMarginSize(theme.widgets.scrollBar.grabber);
  return vertical ? m.y : m.x;
}

/**
 * `ScrollBar::get_minimum_size` (`scroll_bar.cpp:519-548`) with every icon and padding term at 0.
 * The default theme sets all six `increment`/`decrement` icons to an empty `ImageTexture` on both
 * bars (`default_theme.cpp:557-562,572-577`), so `native/themeIcons.ts` vendors none.
 */
export function scrollBarMinimumSize(vertical: boolean, theme: NativeTheme): Vec2 {
  const track = contentMarginSize(trackStyleBox(vertical, theme));
  const grabber = grabberMinAlong(vertical, theme);
  if (vertical) {
    // minsize.width = MAX(incr.width, bg.minwidth); minsize.height = incr.height + decr.height + bg.minheight + grabber_min_size.
    return { x: Math.max(0, track.x), y: track.y + grabber };
  }
  // minsize.height = MAX(incr.height, bg.minheight); minsize.width = incr.width + decr.width + bg.minwidth + grabber_min_size.
  return { x: track.x + grabber, y: Math.max(0, track.y) };
}

/** `ScrollBar::get_area_size` (`scroll_bar.cpp:491-513`): the grabber's travel along the bar. */
export function scrollBarAreaSize(vertical: boolean, barLength: number, theme: NativeTheme): number {
  const track = contentMarginSize(trackStyleBox(vertical, theme));
  const trackAlong = vertical ? track.y : track.x;
  return barLength - trackAlong - grabberMinAlong(vertical, theme);
}

export interface ScrollBarGrabberGeometry {
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
  theme: NativeTheme,
  min: number,
  max: number,
  page: number,
  ratio: number
): ScrollBarGrabberGeometry {
  const range = max - min;
  // scroll_bar.cpp:481-483: "if (range <= 0) return 0", a literal zero grabber size, not the
  // grabber's minimum-size floor.
  if (range <= 0) return { size: 0, offset: 0 };
  const areaSize = scrollBarAreaSize(vertical, barLength, theme);
  // `Range::set_page`'s CLAMP (`range.cpp:254-256`) bounds the stored page to [0, range] before the
  // draw reads it, and `get_page() > 0 ? get_page() : 0` (`scroll_bar.cpp:485`) guards only a
  // negative. No setter chain runs here, so one clamp stands for both.
  const clampedPage = clamp(page, 0, range);
  const size = (clampedPage / range) * areaSize + grabberMinAlong(vertical, theme);
  const offset = areaSize * ratio;
  return { size, offset };
}

/**
 * The `scroll`/`scroll_focus` track rect, `Rect2(ofs, area)` (`scroll_bar.cpp:295-317`): with both
 * icon terms 0 it is the whole bar. `scene/gui/scroll_bar.cpp` never calls `is_layout_rtl()`, so
 * `Control::_size_changed` mirrors a standalone bar whole (`control.cpp:1785-1787`). The highlighted
 * states and `scroll_focus` need interaction, so a still frame never draws them.
 */
export function scrollBarTrackRect(size: Vec2): Rect2 {
  return { x: 0, y: 0, w: size.x, h: size.y };
}

/**
 * The `grabber` StyleBox rect (`scroll_bar.cpp:326-344`). `padding_*` is 0 (`scroll_bar.h`'s `ThemeCache`,
 * no `default_theme.cpp` override, per-node override not modelled), and `style_h_scrollbar`/
 * `style_v_scrollbar` pad only the cross axis (`default_theme.cpp:543-544`), so the grabber starts
 * at its offset and spans the bar across.
 */
export function scrollBarGrabberRect(vertical: boolean, size: Vec2, grabber: ScrollBarGrabberGeometry): Rect2 {
  if (vertical) {
    return { x: 0, y: grabber.offset, w: size.x, h: grabber.size };
  }
  return { x: grabber.offset, y: 0, w: grabber.size, h: size.y };
}
