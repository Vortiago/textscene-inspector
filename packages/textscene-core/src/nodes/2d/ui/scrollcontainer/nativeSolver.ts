/**
 * ScrollContainer's native (WebGL canvas) container solve — a port of
 * `ScrollContainer::get_minimum_size`/`_update_scrollbars`/
 * `_update_scrollbar_position`/`_reposition_children` (`scene/gui/
 * scroll_container.cpp`), on top of `ScrollBar::get_minimum_size`/
 * `get_grabber_size`/`get_area_size`/`get_grabber_offset`
 * (`scene/gui/scroll_bar.cpp`) — `shared/scrollBarSolver.ts`'s
 * `scrollBarMinimumSize`/`scrollBarGrabberGeometry`, the SAME geometry a
 * standalone HScrollBar/VScrollBar registers under, called here with `min`
 * fixed at 0 (ScrollContainer's embedded bars never author `min_value`) —
 * plus `Range::get_as_ratio`/`set_page`'s own CLAMP (`scene/gui/range.cpp`).
 *
 * `scrollContainerScrollBars` is the ONE function both `scrollContainerLayout`
 * (this module, registered as this type's `ContainerLayoutFn`) and
 * `Component.tsx` (the painter) call: it is the single source of the
 * scrollbar geometry (visibility, each bar's own rect, its grabber's rect),
 * so the content-reservation math the layout function needs and the pixels
 * the painter draws can never drift apart into two formulas that happen to
 * agree today. Neither caller may recompute any of this from a narrower
 * subset of the inputs (e.g. re-deriving overflow from `custom_minimum_size`
 * alone) — that reintroduces exactly the drift this module exists to
 * prevent.
 *
 * `theme_override_styles/panel` (`ScrollContainer`'s own background chrome,
 * `NOTIFICATION_DRAW`'s `draw_style_box(theme_cache.panel_style, ...)`) is
 * NOT modelled: the DEFAULT theme registers it as `empty` for this class
 * specifically (`default_theme.cpp:657`, NOT the flat grey fill Panel/
 * PanelContainer default to), and the existing DOM `Component.tsx` renders no
 * background either — adding one here would be a NEW divergence, not a
 * closed one. Its MARGINS are, through `scrollContainerMargins`
 * (`_get_margins`, `:103-130`), because `draw_focus_border` raises them.
 *
 * `scrollbar_h_separation`/`scrollbar_v_separation` (`scroll_container.h:
 * 104-105`) default to 0 and have no `default_theme.cpp` override for the
 * `ScrollContainer` class specifically (only for `Tree`, an unrelated
 * class's OWN internal scrollbars) — so both are always 0 here, never
 * transcribed as a separate constant.
 *
 * Circularity note on `get_minimum_size()` (`scroll_container.cpp:57-71`):
 * Godot's OWN formula reads this Control's CURRENT `get_size()` to decide
 * whether the OTHER axis' AUTO-mode scrollbar would show, before that size
 * is known — workable in Godot's live, incremental layout (which simply
 * reads last frame's size) but not in this codebase's clean two-phase solve,
 * where minimum size is computed bottom-up BEFORE any rect is assigned. This
 * port therefore only reserves the OTHER axis' scrollbar thickness for the
 * SHOW_ALWAYS/RESERVE sub-case (unconditional, no circularity); the
 * DISABLED-axis + OTHER-axis-AUTO combination — content requires disabled-
 * axis DISABLED and the OTHER axis' AUTO scrollbar to depend on a
 * not-yet-known size — approximates that scrollbar as not shown. A narrow,
 * documented gap, not a silent one: `scrollContainerMinimumSize`'s own tests
 * pin exactly this scope.
 *
 * RTL moves the vertical bar to the leading edge and shifts the content past
 * the strip it reserves. Both bars are ANCHORED children, so
 * `Control::_size_changed` mirrors each one's whole rect
 * (`control.cpp:1785-1787`); the content children are not, since Godot places
 * them through `fit_child_in_rect`/`set_rect`, whose `_compute_offsets`
 * un-mirrors precisely what `_size_changed` mirrors back (`control.cpp:906-909`)
 * — `_reposition_children`'s own `ofs.x += width` (`:357-363`) is the whole
 * horizontal move. `_update_scrollbar_position`'s `lmar`/`rmar` swap
 * (`:294-295`) mirrors the left and right margins, which `_get_margins`
 * leaves EQUAL under every theme this codebase resolves, so the swap is an
 * identity here and each bar's rect is mirrored as the anchored child it is. `_update_scroll_hints` (`:605-658`) draws the
 * `scroll_hint_*` TextureRects, which this codebase does not render at all.
 *
 * Every rect/page/ratio formula below was cross-checked against the real
 * engine and `pnpm ref:godot --probe` pixels — see `nativeSolver.test.ts`'s
 * own header for the measurements.
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

/** `scroll_container.h:104-105`'s own default; no theme override for this class (see module doc). */
const SCROLLBAR_SEPARATION = 0;

/** The four content insets `_get_margins` returns, spelled by side rather than as Godot's `Rect2(left, top, right, bottom)` packing. */
export interface ScrollContainerMargins {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * `ScrollContainer::_get_margins` (`scroll_container.cpp:103-130`): the
 * `panel` StyleBox's own margins, each raised to the `focus` StyleBox's when
 * `draw_focus_border` is set.
 *
 * This is the ONLY way `draw_focus_border` reaches a still frame. The focus
 * PANEL is gated on `has_focus(true) || child_has_focus()`
 * (`:474-475`) — runtime state no `.tscn` can author — but the margins are
 * unconditional, and `get_minimum_size` (`:74-75`), `_update_scrollbars`
 * (`:583-585`), `_update_scrollbar_position` (`:289-306`) and
 * `_reposition_children` (`:344-348`) all read them.
 *
 * Default theme: `panel` is a `StyleBoxEmpty` for this class
 * (`default_theme.cpp:655-657`), so every side is 0 without the flag; `focus`
 * is `make_flat_stylebox(style_focus_color)` (`:659`), whose
 * `set_content_margin_individual(Math::round(4 * scale) …)` (`:60`,
 * `default_margin = 4` at `:54`) is `theme.contentMargin`. A
 * `theme_override_styles/panel` or `/focus` on the node wins over either,
 * the same `n.styleBoxes`-first order every other solver follows.
 */
export function scrollContainerMargins(n: SolveNode, theme: SolveContext['theme']): ScrollContainerMargins {
  const panel = n.styleBoxes.panel?.contentMargin ?? { left: 0, top: 0, right: 0, bottom: 0 };
  if (props(n).drawFocusBorder !== true) return { ...panel };
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
 * HScrollBar's own minimum HEIGHT / VScrollBar's own minimum WIDTH — the
 * cross-axis thickness `_update_scrollbar_position` reserves for each embedded
 * bar (`h_scroll->get_combined_minimum_size().height` /
 * `v_scroll->get_combined_minimum_size().width`, `scroll_container.cpp:291-292`)
 * — `scrollBarMinimumSize` (`shared/scrollBarSolver.ts`, the same geometry a
 * standalone HScrollBar/VScrollBar registers under).
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
 * `ScrollContainer::get_minimum_size` (`scroll_container.cpp:39-77`), with the
 * DISABLED-axis/OTHER-axis-AUTO combination approximated per the module doc's
 * circularity note.
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

  // `min_size += margins.position + margins.size` (`scroll_container.cpp:74-75`)
  // — outside both DISABLED branches, so it applies whatever the scroll modes say.
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
 * `scroll_hint_vertical.svg` / `scroll_hint_horizontal.svg`
 * (`scene/theme/icons/`) — 32x24 and 24x32 at scale 1. Only the extent ACROSS
 * each fade is ever read (`get_height()` at `scroll_container.cpp:627,636`,
 * `get_width()` at `:643,652`), since the other axis is anchored to the
 * container.
 */
const SCROLL_HINT_VERTICAL_HEIGHT = 24;
const SCROLL_HINT_HORIZONTAL_WIDTH = 24;

/** One `scroll_hint_*` TextureRect that `_update_scroll_hints` left visible. */
export interface ScrollHintPlacement {
  /** This hint's rect relative to the ScrollContainer's own top-left, exactly as the anchors compute it — which for a vertical hint is TWICE the container wide (`scroll_container.cpp:625`) and cut back by the clip. */
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
   * Each axis' authored scroll offset as its `Range` SETTLES it — never the
   * raw property. Both the grabber's own ratio and the child's own position
   * read this one pair, so the drawn grabber and the scrolled content can
   * never disagree about how far the container actually scrolled.
   */
  scroll: Vec2;
  horizontal: ScrollBarPlacement;
  vertical: ScrollBarPlacement;
  /** `_update_scroll_hints` (`scroll_container.cpp:606-658`) — the edge fades, drawn over the content and under the scrollbars (both are `INTERNAL_MODE_BACK` children added BEFORE the bars, `:905-915`). */
  hints: ScrollContainerHints;
}

/**
 * `ScrollContainer::_update_scroll_hints` (`scroll_container.cpp:606-658`).
 *
 * The two branches are mutually exclusive by construction: the vertical arm
 * hides both nodes unless `!show_horizontal_hints` (`:623,633`) and the
 * horizontal arm unless `!show_vertical_hints` (`:641,651`), so a container
 * overflowing on BOTH axes draws no hint at all.
 *
 * RTL needs no rect of its own. Each hint is an ANCHORED child, so
 * `Control::_size_changed` mirrors its whole rect, and the RTL arms of every
 * `set_anchor_and_offset` here pre-compensate for exactly that mirror — the
 * two cancel, leaving the LTR rect in both directions. What RTL DOES change
 * is which END `SCROLL_HINT_MODE_TOP_AND_LEFT` names on the horizontal axis
 * (`:641,651`), which is a mode test rather than a geometry one.
 *
 * `tile_scroll_hint` is deliberately absent: it only picks `STRETCH_TILE`
 * over `STRETCH_SCALE` on these same nodes (`:751-752`), and both hint icons
 * are gradients UNIFORM along the axis they would tile on, while the other
 * axis is the texture's own extent — so the two stretch modes are
 * pixel-identical under every theme this codebase resolves.
 */
function scrollContainerHints(
  mode: number,
  rtl: boolean,
  size: Vec2,
  innerSize: Vec2,
  largest: Vec2,
  scroll: Vec2
): ScrollContainerHints {
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

/** `Range::set_page`'s own CLAMP (`range.cpp:254-256`): a page can never exceed the range. */
function clampPage(page: number, range: number): number {
  return Math.max(0, Math.min(page, range));
}

/**
 * One axis' authored `scroll_horizontal`/`scroll_vertical` as its own
 * `ScrollBar` settles it — `Range::_calc_value` (`range.cpp:182-200`), which
 * pins a value above `max - page` at `max - page` and only then floors it at
 * `min` (0 here). `ScrollContainer::_update_scrollbars` (`:595-599`) supplies
 * `max` = the largest child's own minimum on this axis and `page` = the
 * content viewport's own extent, and BOTH `Range::set_max` and
 * `Range::set_page` re-run `set_value(shared->val)` — so the offset a `.tscn`
 * authored before either was known is re-clamped once they are, which is why
 * this is the settled value rather than the authored one.
 *
 * `min` is 0 and never authored (`ScrollContainer` leaves its bars' `min_value`
 * at `Range`'s own default), so `max - page < 0` — a viewport bigger than its
 * content — collapses to 0: an offset authored on a container that does not
 * overflow moves nothing at all.
 *
 * `Range::_calc_value`'s step-snapping branch never runs: `ScrollBar`'s own
 * constructor sets `step` to 0 (`scroll_bar.cpp:708`), so a fractional offset
 * survives verbatim.
 */
function settledScrollValue(raw: number, range: number, rawPage: number): number {
  return Math.max(0, Math.min(raw, range - clampPage(rawPage, range)));
}

/**
 * `Range::get_as_ratio()`'s own CLAMP (`range.cpp:308-324`) with `min` fixed
 * at 0 — ScrollContainer's embedded bars never author `min_value`, so this is
 * the ratio `scrollBarGrabberGeometry` (`shared/scrollBarSolver.ts`) takes
 * rather than a `RangeProperties`-driven `rangeRatio`, which this axis has no
 * scene properties to feed.
 */
function scrollRatio(value: number, range: number): number {
  return Math.max(0, Math.min(1, value / range));
}

/**
 * The full scrollbar geometry for one solve of `n` at its own `rect` — the
 * single source `scrollContainerLayout` and `Component.tsx` both read
 * (see this module's own doc for why neither may recompute it independently).
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

  // _update_scrollbars (scroll_container.cpp:592-593): both checks read the
  // SAME un-reserved own size — Godot does not iterate to a fixed point when
  // one bar's reservation would newly cause the other axis to overflow.
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

  // _update_scrollbar_position (scroll_container.cpp:284-308): each bar
  // dodges the OTHER bar's OWN width/height only when that other bar is
  // actually VISIBLE (hmin/vmin there are Size2() when invisible) — a
  // RESERVE-mode bar that isn't currently shown does not push the other
  // bar's own rect around, even though it still reserves content space.
  // `lmar`/`rmar` (`:294-295`) swap under RTL; the two are equal here (module doc).
  const lmar = n.rtl ? margins.right : margins.left;
  const rmar = n.rtl ? margins.left : margins.right;
  const hWidth = rect.w - lmar - rmar - (vVisible ? vThickness : 0);
  const hRect: Rect2 = {
    // An anchored child's rect is mirrored whole under RTL (module doc).
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
 * `ScrollContainer::_reposition_children`'s content-child half
 * (`scroll_container.cpp:341-391`): every visible child is fit into a rect
 * whose SIZE is its own minimum (or the content viewport, for an EXPAND
 * axis) and whose POSITION is the negative authored scroll offset, then
 * passed through the shared `Container::fit_child_in_rect`.
 *
 * Seals the FULL `ScrollContainerLayout` `scrollContainerScrollBars` already
 * computed onto {@link scrollContainerLayoutChannel}, not only the
 * `contentSize` this function itself needs — `horizontal`/`vertical` (each
 * bar's visibility and rect, its grabber's rect) are exactly what
 * `Component.tsx`'s painter needs to draw the scrollbars, computed here from
 * the REAL solve's `ctx` (whose `combinedMinimumSize` cache already has every
 * descendant's minimum size memoised) rather than discarded and later rebuilt
 * by the painter from a FRESH, empty-cache `SolveContext` that re-walks the
 * whole subtree.
 */
export const scrollContainerLayout: ContainerLayoutFn = (n, children, rect, ctx) => {
  const layout = scrollContainerScrollBars(n, ctx, rect);
  const { contentSize } = layout;
  const { x: scrollX, y: scrollY } = layout.scroll;
  // `Point2 ofs = margins.position` (`scroll_container.cpp:348`), then
  // `if (reserve_vscroll) { ...; if (rtl) ofs.x += width; }`
  // (`:357-363`) — the reserved strip sits at the leading
  // edge under RTL, so the content starts past it.
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
 * The **solve handoff** channel (`r3f/controls/native/solveHandoff.ts`)
 * `scrollContainerLayout` seals and `Component.tsx` opens.
 *
 * A channel rather than a share: `scrollContainerScrollBars` reads
 * `ctx.combinedMinimumSize` for the whole content subtree, so it genuinely is
 * solve output and cannot be recomputed from the node and the theme alone.
 */
export const scrollContainerLayoutChannel = defineChannel<ScrollContainerLayout>('ScrollContainer.layout');
