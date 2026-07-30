/**
 * SplitContainer's native (WebGL canvas) rect solve — shared by HSplitContainer
 * and VSplitContainer, whose whole difference is `vertical` (the `boxContainerSolver.ts`
 * pattern for this slice family). Port of Godot 4.6.3's `scene/gui/split_container.cpp`
 * (`SplitContainer::_update_default_dragger_positions`, `_update_dragger_positions`,
 * `_get_valid_range`, `_resort`, `get_minimum_size`) plus the shared
 * `Container::fit_child_in_rect` every placed child still goes through.
 *
 * SCOPE: two children only (this packet's explicit boundary — the modern engine
 * supports N children and N-1 draggers via `split_offsets`/`valid_children`, ported
 * here only for the two-child case every fixture and the deprecated single
 * `split_offset` property already commit to). With exactly two children,
 * `_update_default_dragger_positions` collapses to a closed form:
 *
 *  - both children EXPAND on the split axis (with `stretch_ratio > 0`): the historic
 *    `#ifndef DISABLE_DEPRECATED` fast path (`split_container.cpp:557-563`) —
 *    `wished = size * ratio - sep * 0.5`, `ratio = ratio0 / (ratio0 + ratio1)`,
 *    ignoring both minimums entirely (a deliberate engine behaviour, not an
 *    omission — see the `else` branches of `_update_default_dragger_positions`'s
 *    final loop, `:600-618`, which this file's own module doc walks through).
 *  - only the FIRST expands: `wished = size - sep` (child 0 claims everything
 *    up to the reserved separation, `:611-613`'s "after all expand flags" branch).
 *  - the second alone expands, or neither does: `wished = 0` (`:609-610`'s
 *    "before all expand flags" branch) — the boundary sits at `split_offset` alone.
 *
 * `_update_dragger_positions` (`:621-708`) then clamps `wished + split_offset`
 * (or, `collapsed`, just `wished`) against `_get_valid_range` (`:318-338`):
 * `[first.min_size, size - sep - second.min_size]`, using Godot's own CLAMP
 * semantics (test the LOW bound first) rather than `Math.min`/`Math.max`, which
 * disagree the moment the range is inverted (an oversized pair of minimums).
 *
 * Dragging is an explicit non-goal (`dragging_area_controls`, `set_split_offset`
 * at runtime, the mouse/keyboard `gui_input` branches) — this module renders only
 * the AUTHORED `split_offset`, exactly like every other native solver in this
 * codebase renders one authored frame, never an interaction.
 *
 * `layout_direction` (RTL) is not modelled anywhere else in this codebase (see
 * `native/controlRectSolver.ts`'s own note and `boxContainerSolver.ts`'s), so it
 * is not threaded here either.
 *
 * Pure data + functions, no React, no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type {
  ContainerLayoutFn,
  MinimumSizeFn,
  SolveContext,
} from '../../../../r3f/controls/native/solverRegistry';
import type { ControlProperties } from '../control/types';
import type { SplitContainerProperties } from './splitContainer';
import {
  fitChildInRect,
  hasFlag,
  isSortableControl,
  SIZE_EXPAND,
  SIZE_FILL,
} from './fitChildInRect';

/** `Control` defaults both axes to `SIZE_FILL` (`control.h:229-230`). */
const DEFAULT_SIZE_FLAGS = SIZE_FILL;
/** `Control::stretch_ratio` default (`control.h:231`). */
const DEFAULT_STRETCH_RATIO = 1;

/** `SplitContainer::DraggerVisibility` (`split_container.h`). */
export const DRAGGER_VISIBLE = 0;
const DRAGGER_HIDDEN_COLLAPSED = 2;

/** One child's inputs to the split solve — combined minimum size plus the `Control` fields the offset formula and `fit_child_in_rect` both read. */
export interface SplitChildInput {
  minSize: Vec2;
  hSizeFlags: number;
  vSizeFlags: number;
  stretchRatio: number;
}

/**
 * The axis-scoped subset `computeSplitDraggerPosition` actually needs — reused
 * verbatim by a Native painter that only has each child's OWN
 * `custom_minimum_size` (not the full recursive `combined_minimum_size` the
 * registered solver computes via `SolveContext`), so the SAME formula runs in
 * both places; only the min-size INPUT'S precision differs. See
 * `hsplitcontainer/NativeComponent.tsx`'s module doc for why that gap is
 * bounded and, today, invisible.
 */
export interface SplitAxisChild {
  /** This child's combined minimum size ON THE SPLIT AXIS only. */
  minSize: number;
  /** `SIZE_EXPAND` set on the split axis AND `stretch_ratio > 0` (`split_container.cpp:545,388`). */
  expands: boolean;
  stretchRatio: number;
}

/** Godot's `CLAMP(x, lo, hi)` macro: tests the LOW bound first. Differs from `Math.min(Math.max(x, lo), hi)` when `lo > hi` (an oversized pair of minimums) — ported faithfully rather than "fixed", since that is what the engine itself does. */
function godotClamp(x: number, lo: number, hi: number): number {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

/**
 * `SplitContainer::_update_default_dragger_positions` + `_update_dragger_positions`,
 * specialised to exactly two children (see module doc for the closed form and
 * its citations). Returns `computed_split_offset` — the split axis position,
 * relative to this container's own top-left, where the first child ends and
 * the separation begins.
 */
export function computeSplitDraggerPosition(
  size: number,
  separation: number,
  first: SplitAxisChild,
  second: SplitAxisChild,
  splitOffset: number,
  collapsed: boolean
): number {
  let wished: number;
  if (first.expands && second.expands) {
    const total = first.stretchRatio + second.stretchRatio;
    const ratio = total > 0 ? first.stretchRatio / total : 0.5;
    // `(int)` truncates toward zero (`split_container.cpp:561`) — not `Math.floor`,
    // which would differ on a negative result.
    wished = Math.trunc(size * ratio - separation * 0.5);
  } else if (first.expands) {
    wished = size - separation;
  } else {
    wished = 0;
  }

  const lo = first.minSize;
  const hi = size - separation - second.minSize;
  const raw = collapsed ? wished : wished + splitOffset;
  return godotClamp(raw, lo, hi);
}

/**
 * `SplitContainer::_resort` (`split_container.cpp:710-782`), restricted to
 * exactly two children (see module doc): fits each child into the rect
 * `computeSplitDraggerPosition` derives, in the SAME order as `children`.
 *
 * - 0 children: nothing to place.
 * - 1 child: fit to the WHOLE container rect (`:714-719`) — a SplitContainer
 *   with one child is an ordinary single-child wrapper.
 * - 2 children: the split.
 *
 * More than two is out of this packet's scope (see module doc); callers pass
 * at most two (the registry adapter below slices to the first two sortable
 * children, mirroring the DOM `SplitContainerComponent.tsx`).
 */
export function resortSplitContainer(
  vertical: boolean,
  containerSize: { width: number; height: number },
  separation: number,
  splitOffset: number,
  collapsed: boolean,
  children: readonly SplitChildInput[]
): Rect2[] {
  if (children.length === 0) return [];

  const whole: Rect2 = { x: 0, y: 0, w: containerSize.width, h: containerSize.height };

  if (children.length === 1) {
    const only = children[0]!;
    return [fitChildInRect(whole, only.minSize, only.hSizeFlags, only.vSizeFlags)];
  }

  const [c0, c1] = children as readonly [SplitChildInput, SplitChildInput];
  const size = vertical ? containerSize.height : containerSize.width;

  const axisChild = (c: SplitChildInput): SplitAxisChild => {
    const flags = vertical ? c.vSizeFlags : c.hSizeFlags;
    return {
      minSize: vertical ? c.minSize.y : c.minSize.x,
      expands: hasFlag(flags, SIZE_EXPAND) && c.stretchRatio > 0,
      stretchRatio: c.stretchRatio,
    };
  };

  const draggerPos = computeSplitDraggerPosition(
    size,
    separation,
    axisChild(c0),
    axisChild(c1),
    splitOffset,
    collapsed
  );

  const rect0: Rect2 = vertical
    ? { x: 0, y: 0, w: containerSize.width, h: draggerPos }
    : { x: 0, y: 0, w: draggerPos, h: containerSize.height };
  const secondStart = draggerPos + separation;
  const rect1: Rect2 = vertical
    ? { x: 0, y: secondStart, w: containerSize.width, h: size - secondStart }
    : { x: secondStart, y: 0, w: size - secondStart, h: containerSize.height };

  return [
    fitChildInRect(rect0, c0.minSize, c0.hSizeFlags, c0.vSizeFlags),
    fitChildInRect(rect1, c1.minSize, c1.hSizeFlags, c1.vSizeFlags),
  ];
}

/**
 * `SplitContainer::get_minimum_size` (`split_container.cpp:820-838`): main
 * axis sums every child's minimum plus ONE separation, but ONLY when there
 * are two (or more) children (`:827-829`) — a lone child contributes no
 * separation, matching `resortSplitContainer`'s own one-child fit-to-whole
 * rect. Cross axis is the largest child.
 */
export function splitContainerMinimumSize(
  vertical: boolean,
  separation: number,
  childMinSizes: readonly Vec2[]
): Vec2 {
  let mainAxis = 0;
  let crossAxis = 0;

  for (const size of childMinSizes) {
    if (vertical) {
      crossAxis = Math.max(crossAxis, size.x);
      mainAxis += size.y;
    } else {
      crossAxis = Math.max(crossAxis, size.y);
      mainAxis += size.x;
    }
  }
  if (childMinSizes.length >= 2) mainAxis += separation;

  return vertical ? { x: crossAxis, y: mainAxis } : { x: mainAxis, y: crossAxis };
}

// --- Registry adapters ------------------------------------------------------

/** The `NativeTheme.widgets.splitContainer` fields `resolveSplitSeparation` reads. */
export interface SplitSeparationTheme {
  separation: number;
  grabberExtent: number;
}

/**
 * `SplitContainer::_get_separation` (`split_container.cpp:305-316`),
 * restricted to the `DRAGGER_VISIBLE`/`DRAGGER_HIDDEN` path this packet
 * models (no `touch_dragger_enabled`, out of scope with dragging): `0` for
 * `DRAGGER_HIDDEN_COLLAPSED`, else the theme separation floored against the
 * grabber icon's own extent along the split axis.
 *
 * Exported (not just the registry adapter below) so a Native painter can
 * resolve the SAME separation the layout used for the actual child rects,
 * without a second theme-reading implementation to drift from this one — see
 * `hsplitcontainer/NativeComponent.tsx`'s module doc for why it needs to.
 */
export function resolveSplitSeparation(props: SplitContainerProperties, theme: SplitSeparationTheme): number {
  if (props.draggerVisibility === DRAGGER_HIDDEN_COLLAPSED) return 0;
  const themeSeparation = props.themeOverrideConstants?.separation ?? theme.separation;
  return Math.max(themeSeparation, theme.grabberExtent);
}

function separationOf(n: SolveNode, ctx: SolveContext): number {
  return resolveSplitSeparation(n.node.properties as SplitContainerProperties, ctx.theme.widgets.splitContainer);
}

function toChildInput(node: SolveNode, minSize: Vec2): SplitChildInput {
  const props = node.node.properties as ControlProperties;
  return {
    minSize,
    hSizeFlags: props.sizeFlagsHorizontal ?? DEFAULT_SIZE_FLAGS,
    vSizeFlags: props.sizeFlagsVertical ?? DEFAULT_SIZE_FLAGS,
    stretchRatio: props.sizeFlagsStretchRatio ?? DEFAULT_STRETCH_RATIO,
  };
}

/**
 * Builds the `ContainerLayoutFn` for a split axis. Like `boxContainerSolver.ts`'s
 * equivalent, a SplitContainer has no chrome of its own that insets its
 * children, so `contentRect`'s width/height ARE the full rect to split; its
 * `x`/`y` describe this node's own parent-relative offset and must not leak
 * into a child's (locally-relative) rect.
 *
 * Only the first two SORTABLE children are placed (`Container::as_sortable_control`,
 * `isSortableControl` — an invisible child is skipped entirely, same as every
 * other container solver in this codebase); a third+ sortable child is simply
 * absent from the returned map, which `controlRectSolver.ts` floors to a
 * zero rect — this packet's explicit two-child scope (see module doc).
 */
export function makeSplitContainerLayout(vertical: boolean): ContainerLayoutFn {
  return (n, children, contentRect, ctx) => {
    const props = n.node.properties as SplitContainerProperties;
    const sortable = children.filter(({ node }) => isSortableControl(node)).slice(0, 2);
    const separation = separationOf(n, ctx);
    const inputs = sortable.map(({ node, minSize }) => toChildInput(node, minSize));

    const rects = resortSplitContainer(
      vertical,
      { width: contentRect.w, height: contentRect.h },
      separation,
      props.splitOffset ?? 0,
      props.collapsed === true,
      inputs
    );

    const out = new Map<string, Rect2>();
    sortable.forEach(({ node: child }, i) => out.set(child.path, rects[i]!));
    return out;
  };
}

/** Builds the `MinimumSizeFn` for a split axis — this container's OWN contribution to `Control::get_combined_minimum_size` when it is itself a child. Same two-sortable-child cap as the layout above. */
export function makeSplitContainerMinimumSize(vertical: boolean): MinimumSizeFn {
  return (n, ctx) => {
    const separation = separationOf(n, ctx);
    const sortable = n.children.filter(isSortableControl).slice(0, 2);
    const childMinSizes = sortable.map((child) => ctx.combinedMinimumSize(child));
    return splitContainerMinimumSize(vertical, separation, childMinSizes);
  };
}

// --- Grabber (the ONLY chrome a SplitContainer draws) -----------------------

/** The `NativeTheme.widgets.splitContainer` fields the grabber-visibility test reads. */
export interface SplitGrabberTheme {
  /** `default_theme.cpp:1264-1266` — see `isSplitGrabberVisible`'s doc for what this gates. */
  autohide: boolean;
}

/**
 * `SplitContainerDragger::_notification(NOTIFICATION_DRAW)` (`split_container.cpp:260-273`),
 * restricted to the one case a STATIC previewer (no mouse, no drag, ever) can
 * satisfy: `dragging || mouse_inside` are always false here, so Godot's own
 * draw condition —
 *
 *     dragger_visibility == DRAGGER_VISIBLE && (dragging || mouse_inside || !autohide)
 *
 * — collapses to `dragger_visibility == DRAGGER_VISIBLE && !autohide`. Also
 * gated on `!collapsed`: a collapsed SplitContainer hides the whole dragger
 * Control (`_resort`'s `dragger->set_visible(!collapsed)`, `:726`), which
 * skips `NOTIFICATION_DRAW` entirely regardless of `dragger_visibility`.
 *
 * `autohide` defaults to `1` (true) for every SplitContainer/HSplitContainer/
 * VSplitContainer (`default_theme.cpp:1264-1266`) — so with no
 * `theme_override_constants/autohide` override, THIS RETURNS FALSE for every
 * authored scene: the grabber icon is invisible in a still-frame render unless
 * a scene explicitly disables `autohide`, exactly like the real editor/game
 * viewport before the pointer ever touches the boundary. Verified against
 * `pnpm ref:godot` on `unit-split-container.tscn`: probing the gap between
 * every row's two ColorRects reads back the plain backdrop colour, never the
 * grabber's gray.
 *
 * `split_bar_background` (`default_theme.cpp:1275-1277`) is an EMPTY stylebox
 * and draws nothing regardless of any of this, so it contributes no further
 * visibility case.
 */
export function isSplitGrabberVisible(props: SplitContainerProperties, theme: SplitGrabberTheme): boolean {
  const draggerVisibility = props.draggerVisibility ?? DRAGGER_VISIBLE;
  const autohideOverride = props.themeOverrideConstants?.autohide;
  const autohide = autohideOverride !== undefined ? autohideOverride !== 0 : theme.autohide;
  return props.collapsed !== true && draggerVisibility === DRAGGER_VISIBLE && !autohide;
}

/**
 * The grabber icon's own rect, in this container's local space —
 * `tex_pos = split_bar_rect.position + (split_bar_rect.size - tex_size) * 0.5`
 * (`split_container.cpp:264-268`), where `split_bar_rect` is the separation
 * band at `draggerPos`, full cross-axis extent (`drag_area_margin_begin`/`_end`
 * default to 0 and are not modelled here — they only ever move the invisible
 * DRAG hitbox, out of scope with dragging itself). Not floored/rounded:
 * `draw_texture` accepts a fractional position, same as the engine.
 */
export function splitGrabberIconRect(
  vertical: boolean,
  containerSize: { width: number; height: number },
  draggerPos: number,
  separation: number,
  iconSize: Vec2
): Rect2 {
  const barRect: Rect2 = vertical
    ? { x: 0, y: draggerPos, w: containerSize.width, h: separation }
    : { x: draggerPos, y: 0, w: separation, h: containerSize.height };

  return {
    x: barRect.x + (barRect.w - iconSize.x) / 2,
    y: barRect.y + (barRect.h - iconSize.y) / 2,
    w: iconSize.x,
    h: iconSize.y,
  };
}

/** A sortable child's split-axis inputs, read from its OWN `custom_minimum_size` — see this module's doc for why that (not the full combined minimum) is what a Native painter can reach. */
export function axisChildFromCustomMinimumSize(node: SolveNode, vertical: boolean): SplitAxisChild {
  const props = node.node.properties as ControlProperties;
  const minSize = (vertical ? props.customMinimumSize?.y : props.customMinimumSize?.x) ?? 0;
  const flags = (vertical ? props.sizeFlagsVertical : props.sizeFlagsHorizontal) ?? DEFAULT_SIZE_FLAGS;
  const stretchRatio = props.sizeFlagsStretchRatio ?? DEFAULT_STRETCH_RATIO;
  return { minSize, expands: hasFlag(flags, SIZE_EXPAND) && stretchRatio > 0, stretchRatio };
}
