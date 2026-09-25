/**
 * ScrollContainer's native container solve: a port of `ScrollContainer::get_minimum_size`,
 * `_update_scrollbars`, `_update_scrollbar_position` and `_reposition_children`
 * (`scroll_container.cpp`, `scroll_container.h`), over `shared/scrollBarSolver.ts` for the
 * `scene/gui/scroll_bar.cpp` geometry and the CLAMPs of `scene/gui/range.cpp`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { ControlProperties } from '../control/types';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import { defineChannel } from '../../../../r3f/controls/native/solveHandoff';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { ContainerLayoutFn, MinimumSizeFn, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { fitChildInRect, hasFlag, isSortableControl, SIZE_EXPAND, SIZE_FILL } from '../shared/fitChildInRect';
import { scrollBarGrabberGeometry, scrollBarMinimumSize } from '../shared/scrollBarSolver';
import type { ScrollContainerProperties } from './types';

// ScrollContainer::ScrollMode (scroll_container.h:44-50).
export const SCROLL_MODE_DISABLED = 0;
export const SCROLL_MODE_AUTO = 1;
export const SCROLL_MODE_SHOW_ALWAYS = 2;
export const SCROLL_MODE_SHOW_NEVER = 3;
export const SCROLL_MODE_RESERVE = 4;

/** `scrollbar_h_separation`/`scrollbar_v_separation` default to 0 (`scroll_container.h:104-105`), and `default_theme.cpp` overrides them only for `Tree`. */
const SCROLLBAR_SEPARATION = 0;

/** The four content insets `_get_margins` returns, spelled by side rather than as Godot's `Rect2(left, top, right, bottom)` packing. */
export interface ScrollContainerMargins {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * `ScrollContainer::_get_margins` (`scroll_container.cpp:103-130`): the `panel` margins, each
 * raised to the `focus` margins under `draw_focus_border`. The focus panel needs runtime focus
 * (`:474-475`), but these margins are unconditional: `get_minimum_size` (`:74-75`), `_update_scrollbars`
 * (`:583-585`), `_update_scrollbar_position` (`:289-306`) and `_reposition_children` (`:344-348`) read them.
 */
export function scrollContainerMargins(n: SolveNode, theme: SolveContext['theme']): ScrollContainerMargins {
  // The default `panel` is a `StyleBoxEmpty` (`default_theme.cpp:655-657`), so every side is 0. It
  // is never drawn: `default_theme.cpp:657` registers it `empty`, unlike Panel's grey fill. A
  // node's `theme_override_styles/panel` or `/focus` wins over either default.
  const panel = n.styleBoxes.panel?.contentMargin ?? { left: 0, top: 0, right: 0, bottom: 0 };
  if (props(n).drawFocusBorder !== true) return { ...panel };
  // The default `focus` is `make_flat_stylebox(style_focus_color)` (`:659`), whose
  // `set_content_margin_individual(Math::round(4 * scale) …)` (`:60`, `default_margin = 4` at
  // `:54`) is `theme.contentMargin`.
  const m = theme.contentMargin;
  const focus = n.styleBoxes.focus?.contentMargin ?? { left: m, top: m, right: m, bottom: m };
  return {
    left: Math.max(panel.left, focus.left),
    top: Math.max(panel.top, focus.top),
    right: Math.max(panel.right, focus.right),
    bottom: Math.max(panel.bottom, focus.bottom),
  };
}

function props(n: SolveNode): ScrollContainerProperties {
  return n.node.properties as ScrollContainerProperties;
}

/**
 * The cross-axis thickness `_update_scrollbar_position` reserves for each embedded bar
 * (`h_scroll->get_combined_minimum_size().height` / `v_scroll->get_combined_minimum_size().width`,
 * `scroll_container.cpp:291-292`): `scrollBarMinimumSize`, the geometry a standalone bar uses.
 */
function hScrollThickness(ctx: SolveContext): number {
  return scrollBarMinimumSize(false, ctx.theme).y;
}
function vScrollThickness(ctx: SolveContext): number {
  return scrollBarMinimumSize(true, ctx.theme).x;
}

/** `ScrollContainer::get_minimum_size`'s own child loop (`scroll_container.cpp:44-52`):
 * the componentwise max of every visible child's combined minimum size. */
function largestChildMinSize(n: SolveNode, ctx: SolveContext): Vec2 {
  let x = 0;
  let y = 0;
  for (const child of n.children) {
    if (!isSortableControl(child)) continue;
    const s = ctx.combinedMinimumSize(child);
    if (s.x > x) x = s.x;
    if (s.y > y) y = s.y;
  }
  return { x, y };
}

/**
 * `ScrollContainer::get_minimum_size` (`scroll_container.cpp:39-77`). Godot reads the current
 * `get_size()` (`scroll_container.cpp:57-71`) to decide whether the other axis' AUTO bar shows,
 * which a bottom-up solve cannot know. So only SHOW_ALWAYS and RESERVE reserve the other bar's
 * thickness, and a disabled axis beside an AUTO axis treats that bar as hidden.
 */
export const scrollContainerMinimumSize: MinimumSizeFn = (n, ctx) => {
  const p = props(n);
  const hMode = p.horizontalScrollMode ?? SCROLL_MODE_AUTO;
  const vMode = p.verticalScrollMode ?? SCROLL_MODE_AUTO;
  const largest = largestChildMinSize(n, ctx);

  let x = 0;
  let y = 0;

  if (hMode === SCROLL_MODE_DISABLED) {
    x = largest.x;
    if (vMode === SCROLL_MODE_SHOW_ALWAYS || vMode === SCROLL_MODE_RESERVE) {
      x += vScrollThickness(ctx) + SCROLLBAR_SEPARATION;
    }
  }
  if (vMode === SCROLL_MODE_DISABLED) {
    y = largest.y;
    if (hMode === SCROLL_MODE_SHOW_ALWAYS || hMode === SCROLL_MODE_RESERVE) {
      y += hScrollThickness(ctx) + SCROLLBAR_SEPARATION;
    }
  }

  // `min_size += margins.position + margins.size` (`scroll_container.cpp:74-75`) sits outside
  // both DISABLED branches, so it applies whatever the scroll modes say.
  const margins = scrollContainerMargins(n, ctx.theme);
  return { x: x + margins.left + margins.right, y: y + margins.top + margins.bottom };
};

export interface ScrollBarPlacement {
  /** `ScrollBar::is_visible()` per `_update_scrollbars` (`scroll_container.cpp:592-593`). */
  visible: boolean;
  /** This bar's own rect, relative to the ScrollContainer's own top-left (`_update_scrollbar_position`). */
  rect: Rect2;
  /** The grabber StyleBox's rect, relative to THIS bar's own top-left (`scroll_bar.cpp`'s `NOTIFICATION_DRAW`). */
  grabberRect: Rect2;
}

// ScrollContainer::ScrollHintMode (scroll_container.h:52-57).
const SCROLL_HINT_MODE_DISABLED = 0;
const SCROLL_HINT_MODE_ALL = 1;
const SCROLL_HINT_MODE_TOP_AND_LEFT = 2;
const SCROLL_HINT_MODE_BOTTOM_AND_RIGHT = 3;

/**
 * `scroll_hint_vertical.svg`/`scroll_hint_horizontal.svg` (`scene/theme/icons/`) are 32x24 and
 * 24x32 at scale 1. Only the extent across each fade is read (`get_height()` at
 * `scroll_container.cpp:627,636`, `get_width()` at `:643,652`): the other axis is anchored.
 */
const SCROLL_HINT_VERTICAL_HEIGHT = 24;
const SCROLL_HINT_HORIZONTAL_WIDTH = 24;

/** One `scroll_hint_*` TextureRect that `_update_scroll_hints` left visible. */
export interface ScrollHintPlacement {
  /** This hint's rect relative to the ScrollContainer's own top-left, as the anchors compute it. A vertical hint is twice the container wide (`scroll_container.cpp:625`), cut back by the clip. */
  rect: Rect2;
  /** `true` for the `scroll_hint_vertical` icon (the fade runs down the rect), `false` for `scroll_hint_horizontal`. */
  vertical: boolean;
  flipH: boolean;
  flipV: boolean;
}

/** Both hint nodes' states after `_update_scroll_hints` (`scroll_container.cpp:606-658`); `null` where `set_visible(false)` was called. */
export interface ScrollContainerHints {
  topLeft: ScrollHintPlacement | null;
  bottomRight: ScrollHintPlacement | null;
}

export interface ScrollContainerLayout {
  /** The content viewport's size after scrollbar-strip reservation (`_reposition_children`'s own `size`). */
  contentSize: Vec2;
  /**
   * Each axis' authored scroll offset as its `Range` settles it, never the raw property. The
   * grabber ratio and the child position both read this pair, so they always agree.
   */
  scroll: Vec2;
  horizontal: ScrollBarPlacement;
  vertical: ScrollBarPlacement;
  /** `_update_scroll_hints` (`scroll_container.cpp:606-658`): the edge fades, drawn over the content and under the scrollbars (both are `INTERNAL_MODE_BACK` children added before the bars, `:905-915`). */
  hints: ScrollContainerHints;
}

/**
 * `ScrollContainer::_update_scroll_hints` (`scroll_container.cpp:606-658`). The arms exclude each
 * other: the vertical arm hides both nodes unless `!show_horizontal_hints` (`:623,633`) and the
 * horizontal arm unless `!show_vertical_hints` (`:641,651`), so overflow on both axes draws no hint.
 */
function scrollContainerHints(
  mode: number,
  rtl: boolean,
  size: Vec2,
  innerSize: Vec2,
  largest: Vec2,
  scroll: Vec2
): ScrollContainerHints {
  // `tile_scroll_hint` only picks `STRETCH_TILE` over `STRETCH_SCALE` (`:751-752`). Both icons are
  // gradients uniform along the tiled axis and texture-sized on the other, so the modes match.
  if (mode === SCROLL_HINT_MODE_DISABLED) return { topLeft: null, bottomRight: null };

  const vBelowMax = scroll.y < largest.y - innerSize.y - 1;
  const showVertical = scroll.y > 1 || vBelowMax;
  const hBelowMax = scroll.x < largest.x - innerSize.x - 1;
  const showHorizontal = scroll.x > 1 || hBelowMax;

  if (showVertical) {
    const rectAt = (y: number): Rect2 => ({ x: 0, y, w: size.x * 2, h: SCROLL_HINT_VERTICAL_HEIGHT });
    const wantsTopLeft = mode === SCROLL_HINT_MODE_ALL || mode === SCROLL_HINT_MODE_TOP_AND_LEFT;
    const wantsBottomRight = mode === SCROLL_HINT_MODE_ALL || mode === SCROLL_HINT_MODE_BOTTOM_AND_RIGHT;
    return {
      topLeft:
        !showHorizontal && wantsTopLeft && scroll.y > 1
          ? { rect: rectAt(0), vertical: true, flipH: false, flipV: false }
          : null,
      bottomRight:
        !showHorizontal && wantsBottomRight && vBelowMax
          ? {
              rect: rectAt(size.y - SCROLL_HINT_VERTICAL_HEIGHT),
              vertical: true,
              flipH: false,
              flipV: true,
            }
          : null,
    };
  }

  const rectAt = (x: number): Rect2 => ({ x, y: 0, w: SCROLL_HINT_HORIZONTAL_WIDTH, h: size.y });
  // Each hint is anchored, and the RTL arms of `set_anchor_and_offset` cancel
  // `Control::_size_changed`'s mirror, so RTL keeps the LTR rect. It changes only which end
  // `SCROLL_HINT_MODE_TOP_AND_LEFT` names on this axis (`:641,651`).
  const leading = rtl ? SCROLL_HINT_MODE_BOTTOM_AND_RIGHT : SCROLL_HINT_MODE_TOP_AND_LEFT;
  const trailing = rtl ? SCROLL_HINT_MODE_TOP_AND_LEFT : SCROLL_HINT_MODE_BOTTOM_AND_RIGHT;
  return {
    topLeft:
      (mode === SCROLL_HINT_MODE_ALL || mode === leading) && scroll.x > 1
        ? { rect: rectAt(0), vertical: false, flipH: false, flipV: false }
        : null,
    bottomRight:
      (mode === SCROLL_HINT_MODE_ALL || mode === trailing) && hBelowMax
        ? {
            rect: rectAt(size.x - SCROLL_HINT_HORIZONTAL_WIDTH),
            vertical: false,
            flipH: true,
            flipV: false,
          }
        : null,
  };
}

/** `Range::set_page`'s CLAMP (`range.cpp:254-256`): a page can never exceed the range. */
function clampPage(page: number, range: number): number {
  return Math.max(0, Math.min(page, range));
}

/**
 * One axis' authored `scroll_horizontal`/`scroll_vertical` as its `ScrollBar` settles it:
 * `Range::_calc_value` (`range.cpp:182-200`) pins a value above `max - page` at `max - page`, then
 * floors it at `min`, which is never authored and so 0. The step snap never runs: `ScrollBar`'s
 * constructor sets `step` to 0 (`scroll_bar.cpp:708`), so a fractional offset survives.
 */
function settledScrollValue(raw: number, range: number, rawPage: number): number {
  // `_update_scrollbars` (`:595-599`) sets `max` to the largest child minimum and `page` to the
  // viewport extent. `set_max` and `set_page` both re-run `set_value(shared->val)`, so the
  // authored offset is re-clamped, and a container that does not overflow scrolls by 0.
  return Math.max(0, Math.min(raw, range - clampPage(rawPage, range)));
}

/**
 * `Range::get_as_ratio()`'s CLAMP (`range.cpp:308-324`) with `min` fixed at 0, since the embedded
 * bars never author `min_value`. `rangeRatio` would need `RangeProperties`, which this axis lacks.
 */
function scrollRatio(value: number, range: number): number {
  return Math.max(0, Math.min(1, value / range));
}

/**
 * The scrollbar geometry for one solve of `n` at its `rect`: visibility, each bar's rect and its
 * grabber's rect. `scrollContainerLayout` and `Component.tsx` both read it. Neither may recompute
 * it from a narrower input (overflow from `custom_minimum_size` alone, for example), or the
 * reserved content space and the drawn bars drift apart.
 */
export function scrollContainerScrollBars(
  n: SolveNode,
  ctx: SolveContext,
  rect: Rect2
): ScrollContainerLayout {
  const p = props(n);
  const hMode = p.horizontalScrollMode ?? SCROLL_MODE_AUTO;
  const vMode = p.verticalScrollMode ?? SCROLL_MODE_AUTO;
  const largest = largestChildMinSize(n, ctx);
  const hThickness = hScrollThickness(ctx);
  const vThickness = vScrollThickness(ctx);

  // `size -= margins.position + margins.size` (scroll_container.cpp:583-585):
  // every test and page below reads the margin-reduced extent, never the raw rect.
  const margins = scrollContainerMargins(n, ctx.theme);
  const innerW = rect.w - margins.left - margins.right;
  const innerH = rect.h - margins.top - margins.bottom;

  // _update_scrollbars (scroll_container.cpp:592-593): both checks read the same un-reserved
  // size. Godot does not iterate to a fixed point when one bar's reservation would make the
  // other axis overflow.
  const hVisible =
    hMode === SCROLL_MODE_SHOW_ALWAYS ||
    ((hMode === SCROLL_MODE_AUTO || hMode === SCROLL_MODE_RESERVE) && largest.x > innerW);
  const vVisible =
    vMode === SCROLL_MODE_SHOW_ALWAYS ||
    ((vMode === SCROLL_MODE_AUTO || vMode === SCROLL_MODE_RESERVE) && largest.y > innerH);
  const hReserved = hVisible || hMode === SCROLL_MODE_RESERVE;
  const vReserved = vVisible || vMode === SCROLL_MODE_RESERVE;

  const contentSize: Vec2 = {
    x: innerW - (vReserved ? vThickness + SCROLLBAR_SEPARATION : 0),
    y: innerH - (hReserved ? hThickness + SCROLLBAR_SEPARATION : 0),
  };

  // _update_scrollbar_position (scroll_container.cpp:284-308): each bar dodges the other bar
  // only while that bar is visible (`hmin`/`vmin` are `Size2()` otherwise), so a hidden RESERVE
  // bar reserves content space but moves no bar. `lmar`/`rmar` swap under RTL (`:294-295`), an
  // identity: `_get_margins` keeps them equal under every theme this codebase resolves.
  const lmar = n.rtl ? margins.right : margins.left;
  const rmar = n.rtl ? margins.left : margins.right;
  const hWidth = rect.w - lmar - rmar - (vVisible ? vThickness : 0);
  const hRect: Rect2 = {
    // Both bars are anchored, so `Control::_size_changed` mirrors each whole rect (`control.cpp:1785-1787`).
    x: n.rtl ? rect.w - lmar - hWidth : lmar,
    y: rect.h - hThickness - margins.bottom,
    w: hWidth,
    h: hThickness,
  };
  const vRect: Rect2 = {
    x: n.rtl ? rmar : rect.w - vThickness - rmar,
    y: margins.top,
    w: vThickness,
    h: rect.h - margins.top - margins.bottom - (hVisible ? hThickness : 0),
  };

  const scroll: Vec2 = {
    x: settledScrollValue(p.scrollHorizontal ?? 0, largest.x, hRect.w),
    y: settledScrollValue(p.scrollVertical ?? 0, largest.y, vRect.h),
  };

  // scrollBarGrabberGeometry's `min` fixed at 0: ScrollContainer's embedded
  // bars never author `min_value`, so `range` (largest.x/.y) IS `max`.
  const hGrabber = scrollBarGrabberGeometry(
    false,
    hRect.w,
    ctx.theme,
    0,
    largest.x,
    hRect.w,
    scrollRatio(scroll.x, largest.x)
  );
  const vGrabber = scrollBarGrabberGeometry(
    true,
    vRect.h,
    ctx.theme,
    0,
    largest.y,
    vRect.h,
    scrollRatio(scroll.y, largest.y)
  );

  return {
    contentSize,
    scroll,
    hints: scrollContainerHints(
      p.scrollHintMode ?? SCROLL_HINT_MODE_DISABLED,
      n.rtl,
      { x: rect.w, y: rect.h },
      { x: innerW, y: innerH },
      largest,
      scroll
    ),
    horizontal: {
      visible: hVisible,
      rect: hRect,
      grabberRect: { x: hGrabber.offset, y: 0, w: hGrabber.size, h: hRect.h },
    },
    vertical: {
      visible: vVisible,
      rect: vRect,
      grabberRect: { x: 0, y: vGrabber.offset, w: vRect.w, h: vGrabber.size },
    },
  };
}

/**
 * `ScrollContainer::_reposition_children`'s content half (`scroll_container.cpp:341-391`): each
 * visible child fits a rect sized to its minimum (or the viewport, on an EXPAND axis) at the
 * negative scroll offset, through `Container::fit_child_in_rect`. It seals the whole layout onto
 * {@link scrollContainerLayoutChannel}, so the painter reuses this solve's memoised `ctx`.
 */
export const scrollContainerLayout: ContainerLayoutFn = (n, children, rect, ctx) => {
  const layout = scrollContainerScrollBars(n, ctx, rect);
  const { contentSize } = layout;
  const { x: scrollX, y: scrollY } = layout.scroll;
  // `Point2 ofs = margins.position` (`scroll_container.cpp:348`), then `if (reserve_vscroll) { ...;
  // if (rtl) ofs.x += width; }` (`:357-363`): the reserved strip leads under RTL. `set_rect`'s
  // `_compute_offsets` un-mirrors what `_size_changed` mirrors (`control.cpp:906-909`), so this is
  // the whole RTL move for a content child.
  const margins = scrollContainerMargins(n, ctx.theme);
  const ofsX = margins.left + (n.rtl ? rect.w - margins.left - margins.right - contentSize.x : 0);
  const ofsY = margins.top;

  const out = new Map<string, Rect2>();
  for (const { node: child, minSize } of children) {
    if (!isSortableControl(child)) continue;
    const cp = child.node.properties as ControlProperties;
    const hFlags = cp.sizeFlagsHorizontal ?? SIZE_FILL;
    const vFlags = cp.sizeFlagsVertical ?? SIZE_FILL;

    const w = hasFlag(hFlags, SIZE_EXPAND) ? Math.max(contentSize.x, minSize.x) : minSize.x;
    const h = hasFlag(vFlags, SIZE_EXPAND) ? Math.max(contentSize.y, minSize.y) : minSize.y;
    // `0 - scrollX` rather than `-scrollX`: unary negation of 0 produces -0,
    // which fails a strict rect comparison against the unscrolled +0 case.
    const r: Rect2 = { x: Math.floor(ofsX - scrollX), y: Math.floor(ofsY - scrollY), w, h };

    out.set(child.path, fitChildInRect(r, minSize, hFlags, vFlags, n.rtl));
  }
  return { rects: out, meta: scrollContainerLayoutChannel.seal(layout) };
};

/**
 * The solve-handoff channel (`r3f/controls/native/solveHandoff.ts`) `scrollContainerLayout` seals
 * and `Component.tsx` opens. A channel, not a share: the layout reads `ctx.combinedMinimumSize`
 * for the whole content subtree, which the node and the theme alone cannot give.
 */
export const scrollContainerLayoutChannel = defineChannel<ScrollContainerLayout>('ScrollContainer.layout');
