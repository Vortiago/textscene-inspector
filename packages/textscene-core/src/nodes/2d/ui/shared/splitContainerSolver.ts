/**
 * SplitContainer's native rect solve, shared by HSplitContainer and VSplitContainer,
 * which differ only in `vertical`. Port of Godot 4.6.3's `scene/gui/split_container.cpp`.
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
import { splitOffsetsOf, type SplitContainerProperties } from './splitContainer';
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

/** One child's inputs to the split solve: its combined minimum size and the `Control` fields the offset formula and `fit_child_in_rect` read. */
export interface SplitChildInput {
  minSize: Vec2;
  hSizeFlags: number;
  vSizeFlags: number;
  stretchRatio: number;
}

/**
 * The split-axis subset the dragger formula reads. A Native painter has only each child's own
 * `custom_minimum_size`, not the recursive `combined_minimum_size` from `SolveContext`, and runs
 * the same formula with it. `hsplitcontainer/Component.tsx` says why that gap is bounded.
 */
export interface SplitAxisChild {
  /** This child's combined minimum size on the split axis. */
  minSize: number;
  /** `SIZE_EXPAND` set on the split axis and `stretch_ratio > 0` (`split_container.cpp:545,388`). */
  expands: boolean;
  stretchRatio: number;
}

/** Godot's `CLAMP(x, lo, hi)` macro, which tests the low bound first. It differs from `Math.min(Math.max(x, lo), hi)` when `lo > hi` (two oversized minimums), and the port keeps the engine's result. */
function godotClamp(x: number, lo: number, hi: number): number {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

/**
 * `SplitContainer::_update_default_dragger_positions` (`split_container.cpp:517-618`):
 * where each dragger sits with every offset at zero. The stretch pass shares the free space
 * among `SIZE_EXPAND` children, retries without a child whose share falls below its minimum
 * (`:570-596`) and carries the sub-pixel remainder forward a pixel at a time (`:589-593`).
 */
export function computeDefaultDraggerPositions(
  size: number,
  separation: number,
  children: readonly SplitAxisChild[]
): number[] {
  if (children.length <= 1) return [];

  // `real_t final_size`, narrowed with `(int)` only where the source does.
  const finalSize = children.map((c) => Math.trunc(c.minSize));
  const willStretch = children.map((c) => c.expands);
  const expandCount = children.filter((c) => c.expands).length;

  let stretchableSpace = size - separation * (children.length - 1);
  let stretchTotal = 0;
  children.forEach((c, i) => {
    if (c.expands) stretchTotal += c.stretchRatio;
    else stretchableSpace -= finalSize[i]!;
  });

  if (expandCount === 2 && children.length === 2) {
    // `#ifndef DISABLE_DEPRECATED` (`:557-563`): two expanding children ignore
    // both minimums. `(int)` truncates toward zero, unlike `Math.floor`.
    const total = children[0]!.stretchRatio + children[1]!.stretchRatio;
    const ratio = total > 0 ? children[0]!.stretchRatio / total : 0.5;
    return [Math.trunc(size * ratio - separation * 0.5)];
  }

  while (stretchTotal > 0 && stretchableSpace > 0) {
    let refitSuccessful = true;
    let error = 0;
    for (let i = 0; i < children.length; i++) {
      if (!willStretch[i]) continue;
      const desired = (children[i]!.stretchRatio / stretchTotal) * stretchableSpace;
      error += desired - Math.trunc(desired);
      if (desired < children[i]!.minSize) {
        stretchTotal -= children[i]!.stretchRatio;
        stretchableSpace -= children[i]!.minSize;
        willStretch[i] = false;
        finalSize[i] = Math.trunc(children[i]!.minSize);
        refitSuccessful = false;
        break;
      }
      finalSize[i] = Math.trunc(desired);
      if (error >= 1) {
        finalSize[i]! += 1;
        error -= 1;
      }
    }
    if (refitSuccessful) break;
  }

  // Every dragger before the first expanding child collapses to 0, and every dragger after
  // the last one to `size - sep` (`:605-617`), which pins a fixed-size pair to one end.
  const positions: number[] = [];
  let pos = 0;
  let expandsSeen = 0;
  for (let i = 0; i < children.length - 1; i++) {
    pos += finalSize[i]!;
    if (children[i]!.expands) expandsSeen += 1;
    if (expandsSeen === 0) positions.push(0);
    else if (expandsSeen >= expandCount) positions.push(size - separation);
    else positions.push(pos);
    pos += separation;
  }
  return positions;
}

/**
 * `SplitContainer::_get_valid_range` (`split_container.cpp:318-337`): how far dragger
 * `index` can travel before a child on either side falls under its minimum. Each child up
 * to `index` raises the low bound and each child past it lowers the high bound, and the
 * separations on each side are charged to the same ends.
 */
export function splitDraggerValidRange(
  index: number,
  size: number,
  separation: number,
  children: readonly SplitAxisChild[]
): { min: number; max: number } {
  const draggerCount = children.length - 1;
  let min = separation * index;
  let max = Math.trunc(size) - separation * (draggerCount - index);
  children.forEach((c, i) => {
    if (i <= index) min += Math.trunc(c.minSize);
    else max -= Math.trunc(c.minSize);
  });
  return { min, max };
}

/**
 * `SplitContainer::_update_dragger_positions` (`split_container.cpp:621-707`) at
 * `p_clamp_index === -1`, the layout pass. The other arm prioritises the dragger under the
 * pointer, and this module renders only the authored `split_offsets`. `rtl` is axis-scoped, since
 * the inversion at `:701-707` is guarded on `!vertical`, so a caller passes `rtl && !vertical`.
 */
export function computeSplitDraggerPositions(
  size: number,
  separation: number,
  children: readonly SplitAxisChild[],
  offsets: readonly number[],
  collapsed: boolean,
  rtl = false
): number[] {
  // `const int size = (int)get_size()[axis]` (`:628`): every formula below
  // reads the already-narrowed extent, so the truncation happens once here.
  const axisSize = Math.trunc(size);
  const defaults = computeDefaultDraggerPositions(axisSize, separation, children);
  // RTL inverts each position against the axis size (`:641-646` collapsed, `:703-707`
  // otherwise). `_resort` reads the children back in reverse (`:738-751`), so a grabber
  // drawn at the returned position needs no second flip.
  const invert = (p: number) => (rtl ? axisSize - p - separation : p);

  if (collapsed) {
    return defaults.map((d, i) => {
      const range = splitDraggerValidRange(i, axisSize, separation, children);
      return invert(godotClamp(d, range.min, range.max));
    });
  }

  // Short `offsets` are zero-filled (`resize_initialized`, `:632-634`), and a long tail is
  // never read. `split_offset_pending` (`:1076`) gates only `_get_desired_sizes`
  // (`:912,981,1022`), so it is not ported.
  const positions = defaults.map((d, i) => {
    const range = splitDraggerValidRange(i, axisSize, separation, children);
    return godotClamp(d + (offsets[i] ?? 0), range.min, range.max);
  });

  // Prevent overlaps (`:658-670`): each dragger pushes the next one far enough right to
  // leave the child between them its minimum, then re-clamps itself: index `i`, not
  // `i + 1`, as the source does.
  for (let i = 0; i < positions.length - 1; i++) {
    const pushPos = positions[i]! + separation + Math.trunc(children[i + 1]!.minSize);
    if (positions[i + 1]! < pushPos) {
      positions[i + 1] = pushPos;
      const range = splitDraggerValidRange(i, axisSize, separation, children);
      positions[i] = godotClamp(positions[i]!, range.min, range.max);
    }
  }

  return positions.map(invert);
}

/** A `SplitChildInput`'s split-axis subset. `makeSplitContainerLayout` shares it, so the axis-selection rule has one implementation. */
export function toSplitAxisChild(vertical: boolean, c: SplitChildInput): SplitAxisChild {
  const flags = vertical ? c.vSizeFlags : c.hSizeFlags;
  return {
    minSize: vertical ? c.minSize.y : c.minSize.x,
    expands: hasFlag(flags, SIZE_EXPAND) && c.stretchRatio > 0,
    stretchRatio: c.stretchRatio,
  };
}

/**
 * `SplitContainer::_resort` (`split_container.cpp:710-756`): fits each child into the band
 * between its draggers (`:736-755`). A lone child fits the whole container rect (`:714-719`).
 * `offsets` is the authored `split_offsets`. The RTL arm reads the children back from the
 * opposite end (`:741-744`) against the inverted positions.
 */
export function resortSplitContainer(
  vertical: boolean,
  containerSize: { width: number; height: number },
  separation: number,
  offsets: readonly number[],
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

  // `const Size2i new_size = get_size()` (`:738`); the one-child branch above
  // stays full-precision, as Godot's does.
  const size = Math.trunc(vertical ? containerSize.height : containerSize.width);
  const crossSize = Math.trunc(vertical ? containerSize.width : containerSize.height);
  const horizontalRtl = rtl && !vertical;

  const draggers = computeSplitDraggerPositions(
    size,
    separation,
    children.map((c) => toSplitAxisChild(vertical, c)),
    offsets,
    collapsed,
    horizontalRtl
  );

  return children.map((c, i) => {
    const startPos = horizontalRtl
      ? (i >= draggers.length ? 0 : draggers[i]! + separation)
      : (i === 0 ? 0 : draggers[i - 1]! + separation);
    const endPos = horizontalRtl
      ? (i === 0 ? size : draggers[i - 1]!)
      : (i >= draggers.length ? size : draggers[i]!);
    const band: Rect2 = vertical
      ? { x: 0, y: startPos, w: crossSize, h: endPos - startPos }
      : { x: startPos, y: 0, w: endPos - startPos, h: crossSize };
    return fitChildInRect(band, c.minSize, c.hSizeFlags, c.vSizeFlags, rtl);
  });
}

/**
 * `SplitContainer::get_minimum_size` (`split_container.cpp:820-838`): the main axis sums every
 * child's minimum plus one separation per dragger, added only with two or more children
 * (`:827-829`), since a lone child fits the whole rect. The cross axis is the largest child.
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
  if (childMinSizes.length >= 2) mainAxis += separation * (childMinSizes.length - 1);

  return vertical ? { x: crossAxis, y: mainAxis } : { x: mainAxis, y: crossAxis };
}

/** The `NativeTheme.widgets.splitContainer` fields `resolveSplitSeparation` reads. */
export interface SplitSeparationTheme {
  separation: number;
  grabberExtent: number;
}

/**
 * `SplitContainer::_get_separation` (`split_container.cpp:305-316`) without the out-of-scope
 * `touch_dragger_enabled`: `0` for `DRAGGER_HIDDEN_COLLAPSED`, else the theme separation floored
 * at the grabber's extent on the split axis. A Native painter calls it to get the separation
 * the layout used (`hsplitcontainer/Component.tsx` says why).
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
 * `SplitContainer::_get_grabber_icon` (`split_container.cpp:281-292`): the `is_fixed` types
 * (HSplitContainer, VSplitContainer) register `"grabber"`, and the base `SplitContainer` only
 * `"h_grabber"`/`"v_grabber"` (`default_theme.cpp:1240-1247`). `nativeType` is the live node's
 * class, the key the walker's theme-chain lookup used for `SolveNode.icons`/`textureSlots`.
 */
export function splitGrabberThemeKey(nativeType: string, vertical: boolean): string {
  return nativeType === 'SplitContainer' ? (vertical ? 'v_grabber' : 'h_grabber') : 'grabber';
}

/** `hsplitter.svg`/`vsplitter.svg`'s authored size (`native/themeIcons.ts`): 8px along the split axis, 48px across it. */
export function splitGrabberVendoredSize(vertical: boolean): Vec2 {
  return vertical ? { x: 48, y: 8 } : { x: 8, y: 48 };
}

/** The grabber icon's resolved size: themed (`SolveNode.textureSlots`, keyed by `splitGrabberThemeKey`) if a Theme touched it, else the vendored default. */
export function splitGrabberIconSize(
  nativeType: string,
  vertical: boolean,
  textureSlots: Readonly<Record<string, Vec2 | null>>
): Vec2 {
  return textureSlots[splitGrabberThemeKey(nativeType, vertical)] ?? splitGrabberVendoredSize(vertical);
}

function separationOf(n: SolveNode, ctx: SolveContext, vertical: boolean): number {
  const iconSize = splitGrabberIconSize(n.node.type, vertical, n.textureSlots);
  // The along-axis extent only: `_get_separation`'s `MAX(theme_cache.separation,
  // vertical ? g->get_height() : g->get_width())` (`split_container.cpp:314-316`).
  const grabberExtent = vertical ? iconSize.y : iconSize.x;
  return resolveSplitSeparation(n.node.properties as SplitContainerProperties, n.constants, {
    ...ctx.theme.widgets.splitContainer,
    grabberExtent,
  });
}

/** `vertical` for a live node of any of the three split types. A `TextureSlotsFn` receives only the node, never the resolved flag. */
function verticalOfNode(node: TscnNode): boolean {
  if (node.type === 'VSplitContainer') return true;
  if (node.type === 'HSplitContainer') return false;
  // Typed in `splitcontainer/types.ts`: `SplitContainerProperties` fixes the axis by type
  // and never carries `vertical`.
  return (node.properties as { vertical?: boolean }).vertical ?? false;
}

/** `TextureSlotsFn` for the one themeable grabber slot, registered for all three split types. `verticalOfNode` dispatches on the node, so it needs no factory. */
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
 * The split painters' `ContainerLayoutResult.meta`: the boundaries this layout computed from
 * each sortable child's recursive `combined_minimum_size` (`ctx.combinedMinimumSize`). Without
 * it a painter can read only `custom_minimum_size`.
 */
export interface SplitContainerBoundary {
  /** One entry per dragger: this container's local-space position where each separation band starts (under a horizontal RTL, already inverted, so a painter draws each grabber straight at it). Empty with fewer than two sortable children. */
  draggerPositions: readonly number[];
}

/**
 * The solve-handoff channel (`r3f/controls/native/solveHandoff.ts`) every split axis seals and
 * the three split painters open. A channel, not a share, because no painter can reach `ctx`.
 */
export const splitContainerBoundaryChannel = defineChannel<SplitContainerBoundary>('SplitContainer.boundary');

/**
 * Builds the `ContainerLayoutFn` for a split axis. No chrome insets the children, so
 * `contentRect`'s width and height are the rect to split, and its `x`/`y` (this node's
 * parent-relative offset) must not leak into a child's local rect. An invisible child is
 * skipped (`isSortableControl`, as `_add_valid_child`'s `is_visible()` gate, `:966-968`).
 */
export function makeSplitContainerLayout(vertical: boolean): ContainerLayoutFn {
  return (n, children, contentRect, ctx) => {
    const props = n.node.properties as SplitContainerProperties;
    const sortable = children.filter(({ node }) => isSortableControl(node));
    const separation = separationOf(n, ctx, vertical);
    const inputs = sortable.map(({ node, minSize }) => toChildInput(node, minSize));
    const offsets = splitOffsetsOf(props);

    const rects = resortSplitContainer(
      vertical,
      { width: contentRect.w, height: contentRect.h },
      separation,
      offsets,
      props.collapsed === true,
      inputs,
      n.rtl
    );

    const out = new Map<string, Rect2>();
    sortable.forEach(({ node: child }, i) => out.set(child.path, rects[i]!));

    // Re-run rather than returned by `resortSplitContainer`: it is cheap arithmetic on
    // inputs already in hand.
    const draggerPositions =
      inputs.length >= 2
        ? computeSplitDraggerPositions(
            vertical ? contentRect.h : contentRect.w,
            separation,
            inputs.map((c) => toSplitAxisChild(vertical, c)),
            offsets,
            props.collapsed === true,
            n.rtl && !vertical
          )
        : [];

    return { rects: out, meta: splitContainerBoundaryChannel.seal({ draggerPositions }) };
  };
}

/** Builds the `MinimumSizeFn` for a split axis: this container's own contribution to `Control::get_combined_minimum_size` when it is itself a child. */
export function makeSplitContainerMinimumSize(vertical: boolean): MinimumSizeFn {
  return (n, ctx) => {
    const separation = separationOf(n, ctx, vertical);
    const sortable = n.children.filter(isSortableControl);
    const childMinSizes = sortable.map((child) => ctx.combinedMinimumSize(child));
    return splitContainerMinimumSize(vertical, separation, childMinSizes);
  };
}

// The grabber is the only chrome a SplitContainer draws.

/** The `NativeTheme.widgets.splitContainer` fields the grabber-visibility test reads. */
export interface SplitGrabberTheme {
  /** `default_theme.cpp:1264-1266`. `isSplitGrabberVisible` gates on it. */
  autohide: boolean;
}

/**
 * `SplitContainerDragger::_notification(NOTIFICATION_DRAW)` (`split_container.cpp:260-273`) for
 * a still frame: `dragging || mouse_inside` is always false, so `dragger_visibility ==
 * DRAGGER_VISIBLE && (dragging || mouse_inside || !autohide)` becomes `... && !autohide`.
 */
export function isSplitGrabberVisible(
  props: SplitContainerProperties,
  constants: SolveNode['constants'],
  theme: SplitGrabberTheme
): boolean {
  const draggerVisibility = props.draggerVisibility ?? DRAGGER_VISIBLE;
  const autohideOverride = constants.autohide;
  // `autohide` defaults to 1 on all three split types (`default_theme.cpp:1264-1266`), so
  // without `theme_override_constants/autohide` the grabber is invisible. `pnpm ref:godot`
  // reads the backdrop colour in the gap, never the grabber's grey.
  const autohide = autohideOverride !== undefined ? autohideOverride !== 0 : theme.autohide;
  // A collapsed container hides the dragger (`dragger->set_visible(!collapsed)`, `:726`), so no
  // draw runs. `split_bar_background` is an empty stylebox (`default_theme.cpp:1275-1277`).
  return props.collapsed !== true && draggerVisibility === DRAGGER_VISIBLE && !autohide;
}

/**
 * The grabber icon's rect in local space: `tex_pos = split_bar_rect.position +
 * (split_bar_rect.size - tex_size) * 0.5` (`split_container.cpp:264-268`), the bar being the
 * separation band at `draggerPos`. `drag_area_margin_begin`/`_end` move only the drag hitbox, so
 * they are not ported. `draw_texture` takes a fractional position, so nothing is rounded.
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

/** A sortable child's split-axis inputs from its own `custom_minimum_size`, the only minimum a Native painter can read (`SplitAxisChild` says why). */
export function axisChildFromCustomMinimumSize(node: SolveNode, vertical: boolean): SplitAxisChild {
  const props = node.node.properties as ControlProperties;
  const minSize = (vertical ? props.customMinimumSize?.y : props.customMinimumSize?.x) ?? 0;
  const flags = (vertical ? props.sizeFlagsVertical : props.sizeFlagsHorizontal) ?? DEFAULT_SIZE_FLAGS;
  const stretchRatio = props.sizeFlagsStretchRatio ?? DEFAULT_STRETCH_RATIO;
  return { minSize, expands: hasFlag(flags, SIZE_EXPAND) && stretchRatio > 0, stretchRatio };
}
