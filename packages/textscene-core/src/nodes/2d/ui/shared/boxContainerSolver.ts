/**
 * BoxContainer's native (WebGL canvas) rect solve — shared by HBoxContainer
 * and VBoxContainer, whose whole difference is `vertical`. Port of Godot
 * 4.6.3's `scene/gui/box_container.cpp` (`BoxContainer::_resort`,
 * `BoxContainer::get_minimum_size`) plus the both-axes clamp every Container
 * child goes through, `scene/gui/container.cpp`'s `Container::fit_child_in_rect`.
 *
 * `fit_child_in_rect` runs on BOTH axes for every child, always — not only the
 * cross axis. On the MAIN axis it is a no-op exactly when the child stretched
 * (`_resort` already sized that axis to the stretched amount, which IS its
 * "fill" size), but a child with EXPAND and no FILL never has its `willStretch`
 * cleared by `_resort`, so it still reserves stretch space there — and then
 * `fit_child_in_rect` claws that space back down to the child's own minimum
 * and shrink-positions it inside the reservation, on the SAME axis `_resort`
 * just sized. `alignment` only ever applies when NOTHING stretched
 * (`has_stretched` false) — the instant any child expands, the offset switch
 * below is skipped entirely and `alignment` becomes dead.
 *
 * `layout_direction` (RTL) is not modelled anywhere else in this codebase
 * (see `native/controlRectSolver.ts`'s own note), so every caller of this
 * module passes `rtl = false`; the parameter exists because `_resort` and
 * `fit_child_in_rect` both branch on it, and a solver that hard-codes LTR
 * inside the ported formula (rather than threading the parameter through)
 * would silently diverge from Godot's own source the moment RTL support
 * lands upstream of this module.
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
import type { BoxContainerProperties } from './boxContainer';
import {
  fitChildInRect,
  hasFlag,
  isSortableControl,
  SIZE_EXPAND,
  SIZE_FILL,
} from './fitChildInRect';

/** `Control` defaults both axes to `SIZE_FILL` (`control.h:229-230`); a type whose own parser overrides the flag (e.g. Label's `v_size_flags`) has already baked that override into its parsed properties by the time this module reads them. */
const DEFAULT_SIZE_FLAGS = SIZE_FILL;
/** `Control::stretch_ratio` default (`control.h:231`). */
const DEFAULT_STRETCH_RATIO = 1;

/** One child's inputs to the box solve — its combined minimum size plus the three `Control` fields `_resort`/`fit_child_in_rect` read. */
export interface BoxChildInput {
  minSize: Vec2;
  hSizeFlags: number;
  vSizeFlags: number;
  stretchRatio: number;
}


interface MinSizeCache {
  minSize: number;
  willStretch: boolean;
  finalSize: number;
}

/**
 * `BoxContainer::_resort` (`box_container.cpp:41-235`), returning each
 * child's final `Rect2` in the SAME order as `children` — relative to the
 * box's own top-left, `fit_child_in_rect` already applied.
 */
export function resortBoxContainer(
  vertical: boolean,
  containerSize: { width: number; height: number },
  separation: number,
  alignment: 0 | 1 | 2,
  rtl: boolean,
  children: readonly BoxChildInput[]
): Rect2[] {
  if (children.length === 0) return [];

  // First pass (:57-84): combined minimum size + which children want to stretch.
  const cache: MinSizeCache[] = children.map((c) => {
    const minSize = vertical ? c.minSize.y : c.minSize.x;
    const willStretch = vertical ? hasFlag(c.vSizeFlags, SIZE_EXPAND) : hasFlag(c.hSizeFlags, SIZE_EXPAND);
    return { minSize, willStretch, finalSize: minSize };
  });

  const stretchMin = cache.reduce((sum, m) => sum + m.minSize, 0);
  let stretchAvail = cache.filter((m) => m.willStretch).reduce((sum, m) => sum + m.minSize, 0);
  let stretchRatioTotal = children.reduce(
    (sum, c, i) => (cache[i]!.willStretch ? sum + c.stretchRatio : sum),
    0
  );

  // Stretch range (:90-97).
  const mainAxisSize = vertical ? containerSize.height : containerSize.width;
  const stretchMax = mainAxisSize - (children.length - 1) * separation;
  const stretchDiff = Math.max(0, stretchMax - stretchMin);
  stretchAvail += stretchDiff;

  // Discard/refit loop (:101-145): evict a stretching child whose fair share
  // would undercut its own minimum, then redistribute among the survivors —
  // repeating until every remaining stretcher fits, or none are left.
  let hasStretched = false;
  while (stretchRatioTotal > 0) {
    hasStretched = true;
    let refitSuccessful = true;
    let error = 0; // accumulated fractional pixels, carried into whichever child crosses a whole pixel

    for (let i = 0; i < cache.length; i++) {
      const m = cache[i]!;
      if (!m.willStretch) continue;

      const ratio = children[i]!.stretchRatio;
      const finalPixelSize = (stretchAvail * ratio) / stretchRatioTotal;
      error += finalPixelSize - Math.floor(finalPixelSize);

      if (finalPixelSize < m.minSize) {
        m.willStretch = false;
        stretchRatioTotal -= ratio;
        refitSuccessful = false;
        stretchAvail -= m.minSize;
        m.finalSize = m.minSize;
        break;
      }

      m.finalSize = Math.floor(finalPixelSize);
      if (error >= 1) {
        m.finalSize += 1;
        error -= 1;
      }
    }

    if (refitSuccessful) break;
  }

  // Alignment offset (:149-179) — ONLY when nothing stretched.
  let ofs = 0;
  if (!hasStretched) {
    if (!vertical) {
      if (alignment === 0 && rtl) ofs = stretchDiff;
      else if (alignment === 1) ofs = Math.floor(stretchDiff / 2);
      else if (alignment === 2 && !rtl) ofs = stretchDiff;
    } else {
      if (alignment === 1) ofs = Math.floor(stretchDiff / 2);
      else if (alignment === 2) ofs = stretchDiff;
    }
  }

  // Final placement (:181-235). RTL walks children back-to-front on the
  // horizontal axis only — a vertical box never reorders.
  const rects: Rect2[] = new Array(cache.length);
  const order = !rtl || vertical ? cache.map((_, i) => i) : cache.map((_, i) => cache.length - 1 - i);

  order.forEach((childIndex, idx) => {
    const m = cache[childIndex]!;
    if (idx > 0) ofs += separation;

    const from = ofs;
    let to = ofs + m.finalSize;
    if (m.willStretch && idx === cache.length - 1) {
      // Compensates for accumulated rounding: the last STILL-stretching child snaps to the far edge.
      to = mainAxisSize;
    }
    const size = to - from;

    const placed: Rect2 = vertical
      ? { x: 0, y: from, w: containerSize.width, h: size }
      : { x: from, y: 0, w: size, h: containerSize.height };

    const child = children[childIndex]!;
    rects[childIndex] = fitChildInRect(placed, child.minSize, child.hSizeFlags, child.vSizeFlags, rtl);
    ofs = to;
  });

  return rects;
}

/**
 * `BoxContainer::get_minimum_size` (`box_container.cpp:238-271`): main axis
 * sums each child's minimum plus one `separation` between consecutive
 * children; cross axis is the largest child.
 */
export function boxContainerMinimumSize(
  vertical: boolean,
  separation: number,
  childMinSizes: readonly Vec2[]
): Vec2 {
  let mainAxis = 0;
  let crossAxis = 0;

  childMinSizes.forEach((size, i) => {
    const sep = i === 0 ? 0 : separation;
    if (vertical) {
      crossAxis = Math.max(crossAxis, size.x);
      mainAxis += size.y + sep;
    } else {
      crossAxis = Math.max(crossAxis, size.y);
      mainAxis += size.x + sep;
    }
  });

  return vertical ? { x: crossAxis, y: mainAxis } : { x: mainAxis, y: crossAxis };
}

// --- Registry adapters ------------------------------------------------------

function separationOf(n: SolveNode, ctx: SolveContext): number {
  const props = n.node.properties as BoxContainerProperties;
  return props.themeOverrideConstants?.separation ?? ctx.theme.separation;
}

/** `BoxContainer::AlignmentMode`: absent/out-of-range treated as `ALIGNMENT_BEGIN` (Godot default `0`, `box_container.h`). */
function alignmentOf(n: SolveNode): 0 | 1 | 2 {
  const alignment = (n.node.properties as BoxContainerProperties).alignment;
  return alignment === 1 || alignment === 2 ? alignment : 0;
}

function toChildInput(node: SolveNode, minSize: Vec2): BoxChildInput {
  const props = node.node.properties as ControlProperties;
  return {
    minSize,
    hSizeFlags: props.sizeFlagsHorizontal ?? DEFAULT_SIZE_FLAGS,
    vSizeFlags: props.sizeFlagsVertical ?? DEFAULT_SIZE_FLAGS,
    stretchRatio: props.sizeFlagsStretchRatio ?? DEFAULT_STRETCH_RATIO,
  };
}

/**
 * Builds the `ContainerLayoutFn` for a box axis. BoxContainer has no chrome
 * of its own, so the content rect IS the full rect the walker solved for
 * this node — only its width/height are read; `contentRect.x`/`.y` describe
 * this node's OWN offset within ITS parent, which is irrelevant to where its
 * children sit within IT (every returned rect is relative to this node's own
 * top-left, i.e. local (0, 0), exactly like `resortBoxContainer`'s output
 * already is).
 *
 * Only SORTABLE children take part (`Container::as_sortable_control`,
 * `isSortableControl` — the filter `_resort` applies before anything else):
 * an invisible child claims no slot, no separation and no stretch share, and
 * is simply absent from the returned map, which `controlRectSolver.ts` floors
 * to a zero rect it never paints.
 */
export function makeBoxContainerLayout(vertical: boolean): ContainerLayoutFn {
  return (n, children, contentRect, ctx) => {
    const separation = separationOf(n, ctx);
    const alignment = alignmentOf(n);
    const sortable = children.filter(({ node }) => isSortableControl(node));
    const inputs = sortable.map(({ node, minSize }) => toChildInput(node, minSize));

    const rects = resortBoxContainer(
      vertical,
      { width: contentRect.w, height: contentRect.h },
      separation,
      alignment,
      false, // layout_direction/RTL is not modelled by this codebase (see module doc)
      inputs
    );

    const out = new Map<string, Rect2>();
    sortable.forEach(({ node: child }, i) => out.set(child.path, rects[i]!));
    return out;
  };
}

/** Builds the `MinimumSizeFn` for a box axis — this container's OWN contribution to `Control::get_combined_minimum_size` when it is itself a child. Same sortable-child filter as the layout above (`BoxContainer::get_minimum_size` skips invisible children too). */
export function makeBoxContainerMinimumSize(vertical: boolean): MinimumSizeFn {
  return (n, ctx) => {
    const separation = separationOf(n, ctx);
    const childMinSizes = n.children
      .filter(isSortableControl)
      .map((child) => ctx.combinedMinimumSize(child));
    return boxContainerMinimumSize(vertical, separation, childMinSizes);
  };
}
