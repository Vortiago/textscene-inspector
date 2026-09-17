/**
 * SplitContainer's native (WebGL canvas) rect solve — shared by HSplitContainer
 * and VSplitContainer, whose whole difference is `vertical` (the `boxContainerSolver.ts`
 * pattern for this slice family). Port of Godot 4.6.3's `scene/gui/split_container.cpp`
 * (`SplitContainer::_update_default_dragger_positions`, `_update_dragger_positions`,
 * `_get_valid_range`, `_resort`, `get_minimum_size`) plus the shared
 * `Container::fit_child_in_rect` every placed child still goes through.
 *
 * SCOPE: two children only (a deliberate boundary — the modern engine
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
 * RTL applies to the HORIZONTAL axis only. `_update_dragger_positions` ends by
 * inverting each position against the axis size (`:641-646` collapsed,
 * `:703-707` otherwise), and `_resort`'s own `!vertical && rtl` branch
 * (`:738-751`) then reads the children back in the opposite order — so the
 * reported dragger position IS the inverted one, and the grabber a painter
 * draws at it needs no second flip.
 *
 * Pure data + functions, no React, no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { TscnNode } from '../../../../parser/types';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import { defineChannel } from '../../../../r3f/controls/native/solveHandoff';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type {
  ContainerLayoutFn,
  MinimumSizeFn,
  SolveContext,
  TextureSlotsFn,
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
 * `hsplitcontainer/Component.tsx`'s module doc for why that gap is
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
 * relative to this container's own top-left, where the separation band starts.
 *
 * `rtl` is already AXIS-SCOPED: this function only ever sees one axis, and
 * Godot's inversion is guarded on `!vertical` (`split_container.cpp:703`), so
 * a caller that handles both axes passes `rtl && !vertical`.
 */
export function computeSplitDraggerPosition(
  size: number,
  separation: number,
  first: SplitAxisChild,
  second: SplitAxisChild,
  splitOffset: number,
  collapsed: boolean,
  rtl = false
): number {
  // `const int size = (int)get_size()[axis]` (`split_container.cpp:527`, and the
  // same line in `_update_dragger_positions` and `_get_valid_range`): every
  // formula below reads the ALREADY-narrowed extent, so the truncation happens
  // once here rather than at each use.
  const axisSize = Math.trunc(size);

  let wished: number;
  if (first.expands && second.expands) {
    const total = first.stretchRatio + second.stretchRatio;
    const ratio = total > 0 ? first.stretchRatio / total : 0.5;
    // `(int)` truncates toward zero (`split_container.cpp:561`) — not `Math.floor`,
    // which would differ on a negative result.
    wished = Math.trunc(axisSize * ratio - separation * 0.5);
  } else if (first.expands) {
    // "After all expand flags" (`split_container.cpp:613`).
    wished = axisSize - separation;
  } else {
    wished = 0;
  }

  // `_get_valid_range` narrows both minimums with `(int)` too.
  const lo = Math.trunc(first.minSize);
  const hi = axisSize - separation - Math.trunc(second.minSize);
  const raw = collapsed ? wished : wished + splitOffset;
  const clamped = godotClamp(raw, lo, hi);
  // `size - dragger_positions[i] - sep` (`split_container.cpp:644-645,703-707`)
  // — the caller supplies the split axis, so `!vertical` is implicit here.
  return rtl ? axisSize - clamped - separation : clamped;
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
 * More than two is out of scope (see module doc); callers pass
 * at most two (the registry adapter below slices to the first two sortable
 * children, mirroring the DOM `SplitContainerComponent.tsx`).
 */
/**
 * A `SplitChildInput`'s split-AXIS subset — `SplitAxisChild`, selecting the
 * split-axis component of `minSize`/`sizeFlags`. Exported (not just a local
 * closure inside `resortSplitContainer`) so `makeSplitContainerLayout` can
 * derive the SAME `draggerPos` its own `ContainerLayoutFn` meta reports —
 * one implementation, not two that could drift apart the moment the
 * axis-selection rule changes.
 */
export function toSplitAxisChild(vertical: boolean, c: SplitChildInput): SplitAxisChild {
  const flags = vertical ? c.vSizeFlags : c.hSizeFlags;
  return {
    minSize: vertical ? c.minSize.y : c.minSize.x,
    expands: hasFlag(flags, SIZE_EXPAND) && c.stretchRatio > 0,
    stretchRatio: c.stretchRatio,
  };
}

export function resortSplitContainer(
  vertical: boolean,
  containerSize: { width: number; height: number },
  separation: number,
  splitOffset: number,
  collapsed: boolean,
  children: readonly SplitChildInput[],
  rtl = false
): Rect2[] {
  if (children.length === 0) return [];

  const whole: Rect2 = { x: 0, y: 0, w: containerSize.width, h: containerSize.height };

  if (children.length === 1) {
    const only = children[0]!;
    return [fitChildInRect(whole, only.minSize, only.hSizeFlags, only.vSizeFlags, rtl)];
  }

  const [c0, c1] = children as readonly [SplitChildInput, SplitChildInput];
  // `const Size2i new_size = get_size()` (`split_container.cpp`); the one-child
  // branch above stays full-precision, as Godot's does.
  const size = Math.trunc(vertical ? containerSize.height : containerSize.width);
  const crossSize = Math.trunc(vertical ? containerSize.width : containerSize.height);
  const horizontalRtl = rtl && !vertical;

  const draggerPos = computeSplitDraggerPosition(
    size,
    separation,
    toSplitAxisChild(vertical, c0),
    toSplitAxisChild(vertical, c1),
    splitOffset,
    collapsed,
    horizontalRtl
  );

  // `split_container.cpp:738-751` — under a horizontal RTL the first child
  // takes the band ABOVE the (already inverted) dragger and the second the
  // band below it, which is the mirror of the LTR pair.
  const firstStart = horizontalRtl ? draggerPos + separation : 0;
  const firstEnd = horizontalRtl ? size : draggerPos;
  const secondStart = horizontalRtl ? 0 : draggerPos + separation;
  const secondEnd = horizontalRtl ? draggerPos : size;

  const rect0: Rect2 = vertical
    ? { x: 0, y: firstStart, w: crossSize, h: firstEnd - firstStart }
    : { x: firstStart, y: 0, w: firstEnd - firstStart, h: crossSize };
  const rect1: Rect2 = vertical
    ? { x: 0, y: secondStart, w: crossSize, h: secondEnd - secondStart }
    : { x: secondStart, y: 0, w: secondEnd - secondStart, h: crossSize };

  return [
    fitChildInRect(rect0, c0.minSize, c0.hSizeFlags, c0.vSizeFlags, rtl),
    fitChildInRect(rect1, c1.minSize, c1.hSizeFlags, c1.vSizeFlags, rtl),
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

  // `minimum[axis] += (int)min_size[axis]` / `minimum[other] = (int)MAX(...)`.
  for (const size of childMinSizes) {
    if (vertical) {
      crossAxis = Math.trunc(Math.max(crossAxis, size.x));
      mainAxis += Math.trunc(size.y);
    } else {
      crossAxis = Math.trunc(Math.max(crossAxis, size.y));
      mainAxis += Math.trunc(size.x);
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
 * restricted to the `DRAGGER_VISIBLE`/`DRAGGER_HIDDEN` path this solver
 * models (no `touch_dragger_enabled`, out of scope with dragging): `0` for
 * `DRAGGER_HIDDEN_COLLAPSED`, else the theme separation floored against the
 * grabber icon's own extent along the split axis.
 *
 * Exported (not just the registry adapter below) so a Native painter can
 * resolve the SAME separation the layout used for the actual child rects,
 * without a second theme-reading implementation to drift from this one — see
 * `hsplitcontainer/Component.tsx`'s module doc for why it needs to.
 */
export function resolveSplitSeparation(
  props: SplitContainerProperties,
  constants: SolveNode['constants'],
  theme: SplitSeparationTheme
): number {
  if (props.draggerVisibility === DRAGGER_HIDDEN_COLLAPSED) return 0;
  const themeSeparation = constants.separation ?? theme.separation;
  return Math.max(themeSeparation, theme.grabberExtent);
}

/**
 * `SplitContainer::_get_grabber_icon` (`split_container.cpp:281-292`): a
 * type registering `grabber_icon` under its OWN name — `"grabber"` — is
 * `is_fixed` (HSplitContainer/VSplitContainer); the base `SplitContainer`
 * registers no such item, only `"h_grabber"`/`"v_grabber"`
 * (`default_theme.cpp:1240-1247`). `nativeType` is the LIVE node's own class
 * (`SolveNode.node.type`), which is exactly what the walker's theme-chain
 * lookup already keyed `SolveNode.icons`/`textureSlots` under, so no second
 * type test is needed anywhere else.
 */
export function splitGrabberThemeKey(nativeType: string, vertical: boolean): string {
  return nativeType === 'SplitContainer' ? (vertical ? 'v_grabber' : 'h_grabber') : 'grabber';
}

/** `hsplitter.svg`/`vsplitter.svg`'s own authored size (`native/themeIcons.ts`) — 8px along the split axis, 48px across it, transposed per orientation. Centralised here (each painter used to keep its own copy of this literal) now that the solver-side separation calc needs it too. */
export function splitGrabberVendoredSize(vertical: boolean): Vec2 {
  return vertical ? { x: 48, y: 8 } : { x: 8, y: 48 };
}

/** The grabber icon's resolved size — themed (`SolveNode.textureSlots`, keyed by `splitGrabberThemeKey`) if a Theme touched it, else the vendored default. */
export function splitGrabberIconSize(
  nativeType: string,
  vertical: boolean,
  textureSlots: Readonly<Record<string, Vec2 | null>>
): Vec2 {
  return textureSlots[splitGrabberThemeKey(nativeType, vertical)] ?? splitGrabberVendoredSize(vertical);
}

function separationOf(n: SolveNode, ctx: SolveContext, vertical: boolean): number {
  const iconSize = splitGrabberIconSize(n.node.type, vertical, n.textureSlots);
  // The ALONG-axis extent only — `_get_separation`'s own `MAX(theme_cache.
  // separation, vertical ? g->get_height() : g->get_width())` (`split_container.cpp:314-316`).
  const grabberExtent = vertical ? iconSize.y : iconSize.x;
  return resolveSplitSeparation(n.node.properties as SplitContainerProperties, n.constants, {
    ...ctx.theme.widgets.splitContainer,
    grabberExtent,
  });
}

/**
 * `vertical` for a LIVE node of any of the three split types: fixed by type
 * for HSplitContainer/VSplitContainer, read from the node's own `vertical`
 * property for the base `SplitContainer` (`verticalOf`'s own doc, mirrored
 * here since a `TextureSlotsFn` only receives the node, not this container's
 * already-resolved `vertical` flag).
 */
function verticalOfNode(node: TscnNode): boolean {
  if (node.type === 'VSplitContainer') return true;
  if (node.type === 'HSplitContainer') return false;
  // The base `SplitContainer`'s own `vertical` property — typed in
  // `splitcontainer/types.ts`, not this module's `SplitContainerProperties`
  // (HSplitContainer/VSplitContainer's shared shape, which fixes the axis by
  // TYPE and so never carries the property at all).
  return (node.properties as { vertical?: boolean }).vertical ?? false;
}

/** `TextureSlotsFn` for the one themeable grabber slot — the SAME function registered for all three split types (never a factory: `verticalOfNode` already dispatches on the node itself). */
export const splitContainerTextureSlots: TextureSlotsFn = (node, themedIcons = {}) => {
  const key = splitGrabberThemeKey(node.type, verticalOfNode(node));
  const themed = themedIcons[key];
  return themed ? [{ key, ref: themed.ref, scope: themed.resources }] : [];
};

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
 * `HSplitContainer`/`VSplitContainer`'s `ContainerLayoutFn` meta
 * (`ContainerLayoutResult.meta` — `solverRegistry.ts`'s own doc) — the ONE
 * intermediate their painter (`hsplitcontainer/Component.tsx`,
 * `vsplitcontainer/Component.tsx`) needs and cannot otherwise reach: the
 * split boundary this layout ACTUALLY computed, from the full recursive
 * `combined_minimum_size` of both sortable children
 * (`ctx.combinedMinimumSize`), not the narrower `custom_minimum_size` alone
 * a painter is limited to without this channel.
 */
export interface SplitContainerBoundary {
  /** `computed_split_offset` — this container's own local-space position where the separation band starts (under a horizontal RTL, already inverted, so a painter draws the grabber straight at it). `undefined` with fewer than two sortable children (no boundary to report). */
  draggerPos: number | undefined;
}

/**
 * The **solve handoff** channel (`r3f/controls/native/solveHandoff.ts`) every
 * split axis seals and all three split painters open.
 *
 * A channel rather than a share: the boundary is computed from both sortable
 * children's full recursive `combined_minimum_size` (`ctx`), which no painter
 * can reach.
 */
export const splitContainerBoundaryChannel = defineChannel<SplitContainerBoundary>('SplitContainer.boundary');

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
 * zero rect — the deliberate two-child scope (see module doc).
 */
export function makeSplitContainerLayout(vertical: boolean): ContainerLayoutFn {
  return (n, children, contentRect, ctx) => {
    const props = n.node.properties as SplitContainerProperties;
    const sortable = children.filter(({ node }) => isSortableControl(node)).slice(0, 2);
    const separation = separationOf(n, ctx, vertical);
    const inputs = sortable.map(({ node, minSize }) => toChildInput(node, minSize));

    const rects = resortSplitContainer(
      vertical,
      { width: contentRect.w, height: contentRect.h },
      separation,
      props.splitOffset ?? 0,
      props.collapsed === true,
      inputs,
      n.rtl
    );

    const out = new Map<string, Rect2>();
    sortable.forEach(({ node: child }, i) => out.set(child.path, rects[i]!));

    // `computeSplitDraggerPosition` — the SAME function `resortSplitContainer`
    // calls internally for exactly this pair — re-invoked here (not
    // extracted from `resortSplitContainer`'s own return) since it is O(1)
    // arithmetic on inputs already in hand: cheap enough that duplicating
    // the CALL costs nothing, while `toSplitAxisChild` (not duplicated —
    // exported and shared) keeps the axis-selection RULE itself one
    // implementation.
    const draggerPos =
      inputs.length === 2
        ? computeSplitDraggerPosition(
            vertical ? contentRect.h : contentRect.w,
            separation,
            toSplitAxisChild(vertical, inputs[0]!),
            toSplitAxisChild(vertical, inputs[1]!),
            props.splitOffset ?? 0,
            props.collapsed === true,
            n.rtl && !vertical
          )
        : undefined;

    return { rects: out, meta: splitContainerBoundaryChannel.seal({ draggerPos }) };
  };
}

/** Builds the `MinimumSizeFn` for a split axis — this container's OWN contribution to `Control::get_combined_minimum_size` when it is itself a child. Same two-sortable-child cap as the layout above. */
export function makeSplitContainerMinimumSize(vertical: boolean): MinimumSizeFn {
  return (n, ctx) => {
    const separation = separationOf(n, ctx, vertical);
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
 * `pnpm ref:godot` on a probe scene: probing the gap between
 * every row's two ColorRects reads back the plain backdrop colour, never the
 * grabber's gray.
 *
 * `split_bar_background` (`default_theme.cpp:1275-1277`) is an EMPTY stylebox
 * and draws nothing regardless of any of this, so it contributes no further
 * visibility case.
 */
export function isSplitGrabberVisible(
  props: SplitContainerProperties,
  constants: SolveNode['constants'],
  theme: SplitGrabberTheme
): boolean {
  const draggerVisibility = props.draggerVisibility ?? DRAGGER_VISIBLE;
  const autohideOverride = constants.autohide;
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
