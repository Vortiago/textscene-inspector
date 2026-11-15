/**
 * `BoxContainer::_resort` (`scene/gui/box_container.cpp:41-235`) over plain inputs: where each child
 * of a box lands, given its minimum size, size flags and stretch ratio.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from '../../../../godot/math/rect2';
import type { Vector2 } from '../../../../godot/math/vector';
import { SizeFlags } from '../../../../godot/scene/control';
import { fitChildInRect, hasFlag } from './fitChildInRect';

/** One child's inputs to the box solve: its combined minimum size and the three `Control` fields `_resort`/`fit_child_in_rect` read. */
export interface BoxChildInput {
  minSize: Vector2;
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
 * `BoxContainer::_resort` (`box_container.cpp:41-235`): each child's final `Rect2` in `children`
 * order, relative to the box's top-left, with `fit_child_in_rect` applied. `rtl` is the container's
 * `is_layout_rtl()` (`SolveNode.rtl`), which `_resort` and `fit_child_in_rect` both read.
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

  // Size2i new_size = get_size(); (box_container.cpp:47) truncates toward zero. Every rect on
  // both axes, the cross axis included, is built from this pair, not the full-precision rect.
  const size = { width: Math.trunc(containerSize.width), height: Math.trunc(containerSize.height) };

  // First pass (:57-84): combined minimum size + which children want to stretch.
  const cache: MinSizeCache[] = children.map((c) => {
    // Size2i size = c->get_combined_minimum_size(); (:60): the same truncation, for this stretch
    // bookkeeping only. `fit_child_in_rect`'s re-floor (`native/controlRectSolver.ts`
    // `dispatchChildren`) reads the child's full-precision `minSize`, so `c.minSize` stays intact.
    const minSize = Math.trunc(vertical ? c.minSize.y : c.minSize.x);
    const willStretch = vertical
      ? hasFlag(c.vSizeFlags, SizeFlags.EXPAND)
      : hasFlag(c.hSizeFlags, SizeFlags.EXPAND);
    return { minSize, willStretch, finalSize: minSize };
  });

  const stretchMin = cache.reduce((sum, m) => sum + m.minSize, 0);
  let stretchAvail = cache.filter((m) => m.willStretch).reduce((sum, m) => sum + m.minSize, 0);
  // float stretch_ratio_total = 0.0; accumulated by `stretch_ratio_total +=
  // c->get_stretch_ratio();` in the first-pass loop (:73): a running float32 total, not a
  // float64 sum then cast, so `Math.fround` follows each addition.
  let stretchRatioTotal = 0;
  children.forEach((c, i) => {
    if (cache[i]!.willStretch) stretchRatioTotal = Math.fround(stretchRatioTotal + c.stretchRatio);
  });

  // Stretch range (:90-97): both int, built from the truncated Size2i above.
  const mainAxisSize = vertical ? size.height : size.width;
  const stretchMax = mainAxisSize - (children.length - 1) * separation;
  const stretchDiff = Math.max(0, stretchMax - stretchMin);
  stretchAvail += stretchDiff;

  // Discard/refit loop (:101-145): evict a stretching child whose share would undercut its
  // minimum, then redistribute among the rest, until every stretcher fits or none is left.
  let hasStretched = false;
  while (stretchRatioTotal > 0) {
    hasStretched = true;
    let refitSuccessful = true;
    // float error = 0.0; (:114): fractional pixels carried into whichever child crosses a
    // whole pixel, in float32 as `stretch_ratio_total` is.
    let error = 0;

    for (let i = 0; i < cache.length; i++) {
      const m = cache[i]!;
      if (!m.willStretch) continue;

      const ratio = children[i]!.stretchRatio;
      // float final_pixel_size = stretch_avail * c->get_stretch_ratio() / stretch_ratio_total;
      // (:120-121): both operations round to float32, as a real_t build does. Three 1/3-ish
      // shares sum just over 1 in float64 and just under it in float32, so the precision
      // decides whether the carry below fires.
      const finalPixelSize = Math.fround(Math.fround(stretchAvail * ratio) / stretchRatioTotal);
      // error += final_pixel_size - (int)final_pixel_size; (:123): `(int)` truncates toward
      // zero, and `finalPixelSize` is never negative, so trunc and floor agree.
      error = Math.fround(error + (finalPixelSize - Math.trunc(finalPixelSize)));

      if (finalPixelSize < m.minSize) {
        m.willStretch = false;
        stretchRatioTotal = Math.fround(stretchRatioTotal - ratio);
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

  // Alignment offset (:149-179), only when nothing stretched: once a child expands,
  // `alignment` has no effect.
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

  // Final placement (:181-235). RTL walks children back to front on the horizontal axis
  // only, and a vertical box never reorders.
  const rects: Rect2[] = new Array(cache.length);
  const order = !rtl || vertical ? cache.map((_, i) => i) : cache.map((_, i) => cache.length - 1 - i);

  order.forEach((childIndex, idx) => {
    const m = cache[childIndex]!;
    if (idx > 0) ofs += separation;

    const from = ofs;
    let to = ofs + m.finalSize;
    if (m.willStretch && idx === cache.length - 1) {
      // Compensates for accumulated rounding: the last still-stretching child snaps to the far edge.
      to = mainAxisSize;
    }
    const extent = to - from;

    // `new_size` (the truncated Size2i, :182-186) supplies the cross-axis extent too.
    const placed: Rect2 = vertical
      ? { x: 0, y: from, w: size.width, h: extent }
      : { x: from, y: 0, w: extent, h: size.height };

    // `fit_child_in_rect` runs on both axes. A child with EXPAND and no FILL keeps `willStretch`,
    // so it reserves stretch space on the main axis and the fit shrinks it to its minimum
    // inside that space. For a stretched child the main-axis fit is a no-op.
    const child = children[childIndex]!;
    rects[childIndex] = fitChildInRect(placed, child.minSize, child.hSizeFlags, child.vSizeFlags, rtl);
    ofs = to;
  });

  return rects;
}
