/**
 * ScrollContainer's native (WebGL canvas) container solve — a port of
 * `ScrollContainer::get_minimum_size`/`_update_scrollbars`/
 * `_update_scrollbar_position`/`_reposition_children` (`scene/gui/
 * scroll_container.cpp`) plus the geometry `ScrollBar::get_minimum_size`/
 * `get_grabber_size`/`get_area_size`/`get_grabber_offset` compute
 * (`scene/gui/scroll_bar.cpp`) and `Range::get_as_ratio`/`set_page`'s own
 * CLAMP (`scene/gui/range.cpp`).
 *
 * `scrollContainerScrollBars` is the ONE function both `scrollContainerLayout`
 * (this module, registered as this type's `ContainerLayoutFn`) and
 * `NativeComponent.tsx` (the painter) call: it is the single source of the
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
 * closed one.
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
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { ContainerLayoutFn, MinimumSizeFn, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { fitChildInRect, hasFlag, isSortableControl, SIZE_EXPAND, SIZE_FILL } from '../shared/fitChildInRect';
import type { ScrollContainerProperties } from './types';

// ScrollContainer::ScrollMode (scroll_container.h:44-50).
export const SCROLL_MODE_DISABLED = 0;
export const SCROLL_MODE_AUTO = 1;
export const SCROLL_MODE_SHOW_ALWAYS = 2;
export const SCROLL_MODE_SHOW_NEVER = 3;
export const SCROLL_MODE_RESERVE = 4;

/** `scroll_container.h:104-105`'s own default; no theme override for this class (see module doc). */
const SCROLLBAR_SEPARATION = 0;

function props(n: SolveNode): ScrollContainerProperties {
  return n.node.properties as ScrollContainerProperties;
}

/** A scrollbar's own minimum cross-axis thickness — `ScrollBar::get_minimum_size` with this codebase's
 * default-theme inputs (empty increment/decrement icons, zero padding; see nativeSolver.test.ts's own
 * header): the track's minimum plus the grabber's own minimum, both `2 * contentMargin`. */
function scrollbarThickness(ctx: SolveContext): number {
  return 2 * ctx.theme.contentMargin;
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
 * `ScrollContainer::get_minimum_size` (`scroll_container.cpp:39-77`), minus
 * the `theme_override_styles/panel`/`focus` margin terms (out of scope, see
 * module doc) and with the DISABLED-axis/OTHER-axis-AUTO combination
 * approximated per the module doc's circularity note.
 */
export const scrollContainerMinimumSize: MinimumSizeFn = (n, ctx) => {
  const p = props(n);
  const hMode = p.horizontalScrollMode ?? SCROLL_MODE_AUTO;
  const vMode = p.verticalScrollMode ?? SCROLL_MODE_AUTO;
  const largest = largestChildMinSize(n, ctx);
  const thickness = scrollbarThickness(ctx);

  let x = 0;
  let y = 0;

  if (hMode === SCROLL_MODE_DISABLED) {
    x = largest.x;
    if (vMode === SCROLL_MODE_SHOW_ALWAYS || vMode === SCROLL_MODE_RESERVE) {
      x += thickness + SCROLLBAR_SEPARATION;
    }
  }
  if (vMode === SCROLL_MODE_DISABLED) {
    y = largest.y;
    if (hMode === SCROLL_MODE_SHOW_ALWAYS || hMode === SCROLL_MODE_RESERVE) {
      y += thickness + SCROLLBAR_SEPARATION;
    }
  }

  return { x, y };
};

export interface ScrollBarPlacement {
  /** `ScrollBar::is_visible()` per `_update_scrollbars` (`scroll_container.cpp:592-593`). */
  visible: boolean;
  /** This bar's own rect, relative to the ScrollContainer's own top-left (`_update_scrollbar_position`). */
  rect: Rect2;
  /** The grabber StyleBox's rect, relative to THIS bar's own top-left (`scroll_bar.cpp`'s `NOTIFICATION_DRAW`). */
  grabberRect: Rect2;
}

export interface ScrollContainerLayout {
  /** The content viewport's size after scrollbar-strip reservation (`_reposition_children`'s own `size`). */
  contentSize: Vec2;
  horizontal: ScrollBarPlacement;
  vertical: ScrollBarPlacement;
}

/** `Range::set_page`'s own CLAMP (`range.cpp:254-256`): a page can never exceed the range. */
function clampPage(page: number, range: number): number {
  return Math.max(0, Math.min(page, range));
}

/**
 * One axis' grabber geometry — `ScrollBar::get_grabber_size`/`get_area_size`/
 * `get_grabber_offset` (`scroll_bar.cpp:473-517`) and `Range::get_as_ratio`
 * (`range.cpp:308-324`), with this codebase's default-theme inputs (empty
 * increment/decrement icons and zero padding, so `get_area_size` reduces to
 * `barLength - thickness`) already folded in.
 */
function grabberExtent(
  barLength: number,
  thickness: number,
  range: number,
  rawPage: number,
  rawValue: number
): { size: number; offset: number } {
  const page = clampPage(rawPage, range);
  // scroll_bar.cpp:479-489 — "if (range <= 0) return 0", a literal zero, not
  // the thickness floor `get_minimum_size` would otherwise contribute.
  if (range <= 0) return { size: 0, offset: 0 };
  const areaSize = barLength - thickness;
  const size = (page > 0 ? page : 0) / range * areaSize + thickness;
  const ratio = Math.max(0, Math.min(1, rawValue / range));
  return { size, offset: areaSize * ratio };
}

/**
 * The full scrollbar geometry for one solve of `n` at its own `rect` — the
 * single source `scrollContainerLayout` and `NativeComponent.tsx` both read
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
  const thickness = scrollbarThickness(ctx);

  // _update_scrollbars (scroll_container.cpp:592-593): both checks read the
  // SAME un-reserved own size — Godot does not iterate to a fixed point when
  // one bar's reservation would newly cause the other axis to overflow.
  const hVisible =
    hMode === SCROLL_MODE_SHOW_ALWAYS ||
    ((hMode === SCROLL_MODE_AUTO || hMode === SCROLL_MODE_RESERVE) && largest.x > rect.w);
  const vVisible =
    vMode === SCROLL_MODE_SHOW_ALWAYS ||
    ((vMode === SCROLL_MODE_AUTO || vMode === SCROLL_MODE_RESERVE) && largest.y > rect.h);
  const hReserved = hVisible || hMode === SCROLL_MODE_RESERVE;
  const vReserved = vVisible || vMode === SCROLL_MODE_RESERVE;

  const contentSize: Vec2 = {
    x: rect.w - (vReserved ? thickness + SCROLLBAR_SEPARATION : 0),
    y: rect.h - (hReserved ? thickness + SCROLLBAR_SEPARATION : 0),
  };

  // _update_scrollbar_position (scroll_container.cpp:284-308): each bar
  // dodges the OTHER bar's OWN width/height only when that other bar is
  // actually VISIBLE (hmin/vmin there are Size2() when invisible) — a
  // RESERVE-mode bar that isn't currently shown does not push the other
  // bar's own rect around, even though it still reserves content space.
  const hRect: Rect2 = {
    x: 0,
    y: rect.h - thickness,
    w: rect.w - (vVisible ? thickness : 0),
    h: thickness,
  };
  const vRect: Rect2 = {
    x: rect.w - thickness,
    y: 0,
    w: thickness,
    h: rect.h - (hVisible ? thickness : 0),
  };

  const hGrabber = grabberExtent(hRect.w, thickness, largest.x, hRect.w, p.scrollHorizontal ?? 0);
  const vGrabber = grabberExtent(vRect.h, thickness, largest.y, vRect.h, p.scrollVertical ?? 0);

  return {
    contentSize,
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
 * Returns the FULL `ScrollContainerLayout` `scrollContainerScrollBars`
 * already computed as `meta` (`ContainerLayoutResult.meta` —
 * `solverRegistry.ts`'s own doc), not only the `contentSize` this function
 * itself needs — `horizontal`/`vertical` (each bar's visibility and rect,
 * its grabber's rect) are exactly what `Component.tsx`'s painter needs to
 * draw the scrollbars, computed here from the REAL solve's `ctx` (whose
 * `combinedMinimumSize` cache already has every descendant's minimum size
 * memoised) rather than discarded and later rebuilt by the painter from a
 * FRESH, empty-cache `SolveContext` that re-walks the whole subtree.
 */
export const scrollContainerLayout: ContainerLayoutFn = (n, children, rect, ctx) => {
  const p = props(n);
  const layout = scrollContainerScrollBars(n, ctx, rect);
  const { contentSize } = layout;
  const scrollX = p.scrollHorizontal ?? 0;
  const scrollY = p.scrollVertical ?? 0;

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
    const r: Rect2 = { x: Math.floor(0 - scrollX), y: Math.floor(0 - scrollY), w, h };

    out.set(child.path, fitChildInRect(r, minSize, hFlags, vFlags));
  }
  return { rects: out, meta: layout };
};

/** A runtime shape check for `NativeControlComponentProps.meta` — see `text/textLayout.ts`'s `isTextLayoutResult` for why this is worth a few property reads at a painter's contract boundary. */
export function isScrollContainerLayout(value: unknown): value is ScrollContainerLayout {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ScrollContainerLayout>;
  return (
    typeof v.contentSize === 'object' &&
    v.contentSize !== null &&
    typeof v.horizontal === 'object' &&
    v.horizontal !== null &&
    typeof v.vertical === 'object' &&
    v.vertical !== null
  );
}
