/**
 * Shared HScrollBar/VScrollBar native (WebGL canvas) geometry — a port of
 * `ScrollBar::get_minimum_size`/`get_area_size`/`get_grabber_size`/
 * `get_grabber_offset` and `_notification(NOTIFICATION_DRAW)`'s own rect math
 * (`scene/gui/scroll_bar.cpp`, Godot 4.6.3), transposed for `vertical` (the
 * `shared/sliderSolver.ts` pattern for a slice family: HScrollBar and
 * VScrollBar register this ONCE here, and each slice's own `nativeSolver.ts`/
 * `Component.tsx` supplies only its own `vertical` flag).
 *
 * A near-identical grabber formula already exists, inlined, in
 * `scrollcontainer/nativeSolver.ts`'s `grabberExtent`/`scrollbarThickness`
 * for `ScrollContainer`'s OWN embedded `h_scroll`/`v_scroll` — that version
 * is the `min = 0` special case of `scrollBarGrabberGeometry` below (its
 * `thickness` is this module's along-axis `grabberMin`). It was not reused
 * here because it is not exported; a standalone `ScrollBar` is driven by its
 * OWN `min_value` (which `ScrollContainer`'s bars never author), so this
 * module takes `min`/`max` rather than a bare `range`.
 *
 * NOT modelled — an explicit restriction, matching this codebase's existing
 * theme scope everywhere else:
 *  - `increment`/`decrement` icons — the DEFAULT theme sets all six
 *    (normal/highlight/pressed, both ends) to an EMPTY `ImageTexture`
 *    (`default_theme.cpp:557-562,572-577`), zero size, for BOTH HScrollBar
 *    and VScrollBar — so every icon-size term below is 0, and nothing is
 *    vendored for them in `native/themeIcons.ts`.
 *  - `theme_override_constants/padding_*` — HScrollBar's `padding_top`/
 *    `padding_bottom` and VScrollBar's `padding_left`/`padding_right`
 *    default to 0 (`scroll_bar.h`'s own `ThemeCache` struct) with no
 *    `default_theme.cpp` override, and this codebase does not model a
 *    per-node theme-constant override for any widget.
 *  - hover/focus/drag ("highlighted") draw states and the `scroll_focus`
 *    StyleBox — interactive states a static previewer never reaches, the
 *    same restriction as every other widget here.
 *  - `is_layout_rtl()` — no notion of layout direction anywhere in this
 *    codebase; every rect below is the LTR branch.
 *
 * Pure data + functions, no React, no THREE.
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

/** This axis' own track StyleBox — `scroll_style` (`scroll_bar.cpp`'s `theme_cache.scroll_style`). */
function trackStyleBox(vertical: boolean, theme: NativeTheme) {
  return vertical ? theme.widgets.scrollBar.scrollVertical : theme.widgets.scrollBar.scrollHorizontal;
}

/** The grabber StyleBox's own along-axis minimum — `get_grabber_min_size()` (`scroll_bar.cpp:473-477`). */
function grabberMinAlong(vertical: boolean, theme: NativeTheme): number {
  const m = contentMarginSize(theme.widgets.scrollBar.grabber);
  return vertical ? m.y : m.x;
}

/**
 * `ScrollBar::get_minimum_size` (`scroll_bar.cpp:519-548`), with every icon
 * term at 0 and every padding term at 0 (see module doc).
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

/**
 * `ScrollBar::get_area_size` (`scroll_bar.cpp:491-513`) — the grabber's own
 * travel, along the bar's length axis.
 */
export function scrollBarAreaSize(vertical: boolean, barLength: number, theme: NativeTheme): number {
  const track = contentMarginSize(trackStyleBox(vertical, theme));
  const trackAlong = vertical ? track.y : track.x;
  return barLength - trackAlong - grabberMinAlong(vertical, theme);
}

export interface ScrollBarGrabberGeometry {
  /** Along-axis extent — `get_grabber_size()`. */
  size: number;
  /** Along-axis offset from the bar's own top/left — `get_grabber_offset()`. */
  offset: number;
}

/**
 * `get_grabber_size`/`get_grabber_offset` (`scroll_bar.cpp:479-517`), fed a
 * ratio already resolved by `rangeRatio` (`shared/range.ts` —
 * `Range::get_as_ratio()`, `exp_edit` included) rather than recomputing it
 * from `value`/`min`/`max` here.
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
  // scroll_bar.cpp:481-483 — "if (range <= 0) return 0", a literal zero
  // grabber size, not the grabber's own minimum-size floor.
  if (range <= 0) return { size: 0, offset: 0 };
  const areaSize = scrollBarAreaSize(vertical, barLength, theme);
  // `Range::set_page`'s own CLAMP (`range.cpp:254-256`) already bounds the
  // STORED page to [0, range] before `NOTIFICATION_DRAW` ever reads it;
  // `get_page() > 0 ? get_page() : 0` (`scroll_bar.cpp:485`) only guards a
  // literal negative, never re-clamps the ceiling — reproduced here as one
  // clamp since this module does not simulate the setter chain.
  const clampedPage = clamp(page, 0, range);
  const size = (clampedPage / range) * areaSize + grabberMinAlong(vertical, theme);
  const offset = areaSize * ratio;
  return { size, offset };
}

/**
 * The `scroll`/`scroll_focus` track rect — `Rect2(ofs, area)`
 * (`scroll_bar.cpp:295-317`). With both icon terms 0, `ofs` stays `(0, 0)`
 * and `area` stays the bar's own full size.
 */
export function scrollBarTrackRect(size: Vec2): Rect2 {
  return { x: 0, y: 0, w: size.x, h: size.y };
}

/**
 * The `grabber` StyleBox rect (`scroll_bar.cpp:326-344`). Padding is 0 on
 * both axes (see module doc) and `scroll_style->get_margin` is 0 on the
 * ALONG axis for both orientations (`style_h_scrollbar`/`style_v_scrollbar`
 * only pad the CROSS axis, `default_theme.cpp:543-544`) — so the along-axis
 * origin is exactly the grabber's own offset, and the cross-axis extent is
 * the bar's own full size.
 */
export function scrollBarGrabberRect(vertical: boolean, size: Vec2, grabber: ScrollBarGrabberGeometry): Rect2 {
  if (vertical) {
    return { x: 0, y: grabber.offset, w: size.x, h: grabber.size };
  }
  return { x: grabber.offset, y: 0, w: grabber.size, h: size.y };
}
