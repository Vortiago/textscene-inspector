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
import type { Rect2 } from '../../../../godot/math/rect2';
import { defineChannel } from '../../../../r3f/controls/native/solveHandoff';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type {
  ContainerLayoutFn,
  MinimumSizeFn,
  SolveContext,
} from '../../../../r3f/controls/native/solverRegistry';
import { fitChildInRect, hasFlag, isSortableControl } from '../shared/fitChildInRect';
import {
  SCROLL_HINT_HORIZONTAL_WIDTH,
  SCROLL_HINT_VERTICAL_HEIGHT,
  scrollBarPlacement,
  scrollBarThicknesses,
  type ScrollBarPlacement,
  type ScrollHintPlacement,
} from '../shared/scrollBarSolver';
import { internalScrollBarBoxes } from '../shared/scrollBarBoxes';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import type { ScrollContainerProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import { SizeFlags } from '../../../../godot/scene/control';
import { ScrollContainerScrollHintMode, ScrollMode } from '../../../../godot/scene/gui';
import { clampRangeValue } from '../shared/range';

/** `scrollbar_h_separation`/`scrollbar_v_separation` default to 0 (`scroll_container.h:104-105`), and the table sets them only for `Tree`. */
const SCROLLBAR_SEPARATION = 0;

/** The four content insets `_get_margins` returns, spelled by side rather than as Godot's `Rect2(left, top, right, bottom)` packing. */
interface ScrollContainerMargins {
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
function scrollContainerMargins(n: SolveNode): ScrollContainerMargins {
  const panel = requiredThemeItem(n.styleBoxes, 'panel').contentMargin;
  if (props(n).drawFocusBorder !== true) return { ...panel };
  const focus = requiredThemeItem(n.styleBoxes, 'focus').contentMargin;
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

/** `ScrollContainer::get_minimum_size`'s own child loop (`scroll_container.cpp:44-52`):
 * the componentwise max of every visible child's combined minimum size. */
function largestChildMinSize(n: SolveNode, ctx: SolveContext): Vector2 {
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
  const hMode = p.horizontalScrollMode ?? ScrollMode.AUTO;
  const vMode = p.verticalScrollMode ?? ScrollMode.AUTO;
  const largest = largestChildMinSize(n, ctx);

  let x = 0;
  let y = 0;

  if (hMode === ScrollMode.DISABLED) {
    x = largest.x;
    if (vMode === ScrollMode.SHOW_ALWAYS || vMode === ScrollMode.RESERVE) {
      x += scrollBarThicknesses(internalScrollBarBoxes(n)).verticalWidth + SCROLLBAR_SEPARATION;
    }
  }
  if (vMode === ScrollMode.DISABLED) {
    y = largest.y;
    if (hMode === ScrollMode.SHOW_ALWAYS || hMode === ScrollMode.RESERVE) {
      y += scrollBarThicknesses(internalScrollBarBoxes(n)).horizontalHeight + SCROLLBAR_SEPARATION;
    }
  }

  // `min_size += margins.position + margins.size` (`scroll_container.cpp:74-75`) sits outside
  // both DISABLED branches, so it applies whatever the scroll modes say.
  const margins = scrollContainerMargins(n);
  return { x: x + margins.left + margins.right, y: y + margins.top + margins.bottom };
};

/** Both hint nodes' states after `_update_scroll_hints` (`scroll_container.cpp:606-658`); `null` where `set_visible(false)` was called. */
interface ScrollContainerHints {
  topLeft: ScrollHintPlacement | null;
  bottomRight: ScrollHintPlacement | null;
}

interface ScrollContainerLayout {
  /** The content viewport's size after scrollbar-strip reservation (`_reposition_children`'s own `size`). */
  contentSize: Vector2;
  /**
   * Each axis' authored scroll offset as its `Range` settles it, never the raw property. The
   * grabber ratio and the child position both read this pair, so they always agree.
   */
  scroll: Vector2;
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
  size: Vector2,
  innerSize: Vector2,
  largest: Vector2,
  scroll: Vector2
): ScrollContainerHints {
  // `tile_scroll_hint` only picks `STRETCH_TILE` over `STRETCH_SCALE` (`:751-752`). Both icons are
  // gradients uniform along the tiled axis and texture-sized on the other, so the modes match.
  if (mode === ScrollContainerScrollHintMode.DISABLED) return { topLeft: null, bottomRight: null };

  const vBelowMax = scroll.y < largest.y - innerSize.y - 1;
  const showVertical = scroll.y > 1 || vBelowMax;
  const hBelowMax = scroll.x < largest.x - innerSize.x - 1;
  const showHorizontal = scroll.x > 1 || hBelowMax;

  if (showVertical) {
    const rectAt = (y: number): Rect2 => ({ x: 0, y, w: size.x * 2, h: SCROLL_HINT_VERTICAL_HEIGHT });
    const wantsTopLeft =
      mode === ScrollContainerScrollHintMode.ALL || mode === ScrollContainerScrollHintMode.TOP_AND_LEFT;
    const wantsBottomRight =
      mode === ScrollContainerScrollHintMode.ALL || mode === ScrollContainerScrollHintMode.BOTTOM_AND_RIGHT;
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
  const leading = rtl
    ? ScrollContainerScrollHintMode.BOTTOM_AND_RIGHT
    : ScrollContainerScrollHintMode.TOP_AND_LEFT;
  const trailing = rtl
    ? ScrollContainerScrollHintMode.TOP_AND_LEFT
    : ScrollContainerScrollHintMode.BOTTOM_AND_RIGHT;
  return {
    topLeft:
      (mode === ScrollContainerScrollHintMode.ALL || mode === leading) && scroll.x > 1
        ? { rect: rectAt(0), vertical: false, flipH: false, flipV: false }
        : null,
    bottomRight:
      (mode === ScrollContainerScrollHintMode.ALL || mode === trailing) && hBelowMax
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
  return clampRangeValue(raw, 0, range, clampPage(rawPage, range));
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
  const hMode = p.horizontalScrollMode ?? ScrollMode.AUTO;
  const vMode = p.verticalScrollMode ?? ScrollMode.AUTO;
  const largest = largestChildMinSize(n, ctx);
  const boxes = internalScrollBarBoxes(n);
  // `_update_scrollbar_position` reserves each bar's combined minimum size (`scroll_container.cpp:291-292`).
  const { horizontalHeight: hThickness, verticalWidth: vThickness } = scrollBarThicknesses(boxes);

  // `size -= margins.position + margins.size` (scroll_container.cpp:583-585):
  // every test and page below reads the margin-reduced extent, never the raw rect.
  const margins = scrollContainerMargins(n);
  const innerW = rect.w - margins.left - margins.right;
  const innerH = rect.h - margins.top - margins.bottom;

  // _update_scrollbars (scroll_container.cpp:592-593): both checks read the same un-reserved
  // size. Godot does not iterate to a fixed point when one bar's reservation would make the
  // other axis overflow.
  const hVisible =
    hMode === ScrollMode.SHOW_ALWAYS ||
    ((hMode === ScrollMode.AUTO || hMode === ScrollMode.RESERVE) && largest.x > innerW);
  const vVisible =
    vMode === ScrollMode.SHOW_ALWAYS ||
    ((vMode === ScrollMode.AUTO || vMode === ScrollMode.RESERVE) && largest.y > innerH);
  const hReserved = hVisible || hMode === ScrollMode.RESERVE;
  const vReserved = vVisible || vMode === ScrollMode.RESERVE;

  const contentSize: Vector2 = {
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

  const scroll: Vector2 = {
    x: settledScrollValue(p.scrollHorizontal ?? 0, largest.x, hRect.w),
    y: settledScrollValue(p.scrollVertical ?? 0, largest.y, vRect.h),
  };

  return {
    contentSize,
    scroll,
    hints: scrollContainerHints(
      p.scrollHintMode ?? ScrollContainerScrollHintMode.DISABLED,
      n.rtl,
      { x: rect.w, y: rect.h },
      { x: innerW, y: innerH },
      largest,
      scroll
    ),
    // `min_value` is never authored, so `range` (largest.x/.y) is `max`.
    horizontal: scrollBarPlacement(
      false,
      hRect,
      boxes.horizontal,
      largest.x,
      scrollRatio(scroll.x, largest.x),
      hVisible
    ),
    vertical: scrollBarPlacement(
      true,
      vRect,
      boxes.vertical,
      largest.y,
      scrollRatio(scroll.y, largest.y),
      vVisible
    ),
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
  const margins = scrollContainerMargins(n);
  const ofsX = margins.left + (n.rtl ? rect.w - margins.left - margins.right - contentSize.x : 0);
  const ofsY = margins.top;

  const out = new Map<string, Rect2>();
  for (const { node: child, minSize } of children) {
    if (!isSortableControl(child)) continue;
    const cp = child.node.properties as ControlProperties;
    const hFlags = cp.sizeFlagsHorizontal ?? SizeFlags.FILL;
    const vFlags = cp.sizeFlagsVertical ?? SizeFlags.FILL;

    const w = hasFlag(hFlags, SizeFlags.EXPAND) ? Math.max(contentSize.x, minSize.x) : minSize.x;
    const h = hasFlag(vFlags, SizeFlags.EXPAND) ? Math.max(contentSize.y, minSize.y) : minSize.y;
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
