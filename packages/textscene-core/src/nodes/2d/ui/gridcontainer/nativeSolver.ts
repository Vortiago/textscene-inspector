/**
 * GridContainer's native (WebGL canvas) rect solve — a port of
 * `GridContainer::_notification`'s `NOTIFICATION_SORT_CHILDREN` handler and
 * `GridContainer::get_minimum_size` (`scene/gui/grid_container.cpp`), plus
 * the shared `Container::fit_child_in_rect` (`scene/gui/container.cpp:95-128`)
 * every container child goes through.
 *
 * A second floor applies on top of `fit_child_in_rect`, ported here from a
 * THIRD file neither of the two above calls out:
 * `Control::set_rect`/`Control::_size_changed` (`scene/gui/control.cpp:1531-
 * 1541,1760-1797`). `fit_child_in_rect` ends by calling `set_rect`, and
 * `set_rect` unconditionally re-derives the child's rect and re-floors it
 * against the child's OWN full-precision `get_combined_minimum_size()` — the
 * SAME floor `native/controlRectSolver.ts` already ports for the free/anchored
 * path (`GROW_DIRECTION_*`). This double floor is invisible whenever a
 * `custom_minimum_size` is integral (this container's own `col_minw`/`row_minh`
 * bookkeeping casts every child minimum to `Size2i`, `grid_container.cpp:290`,
 * losing nothing), but a FRACTIONAL minimum size — which is what any
 * font-metric-derived minimum actually is — makes the container's truncated
 * cell smaller than the child's own true minimum, and the child's final rect
 * grows past that cell rather than clipping to it. Confirmed against the live
 * engine (`s9-gridcontainer/probe-project`, scenarios h/i):
 * `custom_minimum_size = Vector2(10.7, 5)` in a column whose bookkeeping
 * truncates to width 10 renders at width 10.7, and with
 * `grow_horizontal = 0` (`GROW_DIRECTION_BEGIN`) shifts its own x by exactly
 * `-0.7` to grow toward the cell's leading edge instead of overflowing its
 * trailing one.
 *
 * RTL (`is_layout_rtl()`) is out of scope everywhere this codebase touches
 * anchors/containers (`native/controlRectSolver.ts`'s own note), so the
 * phantom-column insertion, `fit_child_in_rect`, and the minimum-size floor
 * below all take the non-RTL branch only.
 *
 * Pure data + functions, no React, no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { ControlProperties } from '../control/types';
import type { GridContainerProperties } from './types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import {
  controlSolverRegistry,
  type ContainerLayoutFn,
  type MinimumSizeFn,
} from '../../../../r3f/controls/native/solverRegistry';
import { SIZE_EXPAND, SIZE_FILL, fitChildInRect, hasFlag, isSortableControl } from '../shared/fitChildInRect';

/** `Control::SizeFlags` (`control.h:79-85`). */

/** `Control` defaults both axes to `SIZE_FILL` (`control.h:229-230`); a type whose own parser overrides the flag (e.g. Label's `v_size_flags`) has already baked that override into its parsed properties by the time this module reads them. */
const DEFAULT_SIZE_FLAGS = SIZE_FILL;



function props(n: SolveNode): ControlProperties {
  return n.node.properties as ControlProperties;
}

function hFlagsOf(n: SolveNode): number {
  return props(n).sizeFlagsHorizontal ?? DEFAULT_SIZE_FLAGS;
}

function vFlagsOf(n: SolveNode): number {
  return props(n).sizeFlagsVertical ?? DEFAULT_SIZE_FLAGS;
}


function columnsOf(n: SolveNode): number {
  return Math.max(1, (n.node.properties as GridContainerProperties).columns ?? 1);
}

function separationOf(n: SolveNode, key: 'h_separation' | 'v_separation', theme: NativeTheme): number {
  return n.constants[key] ?? theme.separation;
}

// --- get_minimum_size ---------------------------------------------------------

/**
 * `GridContainer::get_minimum_size` (`grid_container.cpp:273-320`): sum of
 * per-column max widths plus one `h_separation` per column USED past the
 * first, same for rows/`v_separation`. `max_col`/`max_row` there are the
 * 0-based INDEX of the last used column/row, so multiplying directly by the
 * separation already yields "count − 1" — unlike `_resort`'s OWN
 * `max_col`/`max_row` below, which are COUNTS; the two Godot functions name
 * the same shape of value differently. Each child's own combined minimum size
 * is truncated to integer (`Size2i ms = ...`, `:290`) before folding into the
 * column/row maximum.
 */
export const gridContainerMinimumSize: MinimumSizeFn = (n, ctx) => {
  const columns = columnsOf(n);
  const colMinW = new Map<number, number>();
  const rowMinH = new Map<number, number>();
  let maxColIndex = 0;
  let maxRowIndex = 0;
  let validIndex = 0;

  for (const child of n.children) {
    if (!isSortableControl(child)) continue;
    const row = Math.floor(validIndex / columns);
    const col = validIndex % columns;
    validIndex++;

    const ms = ctx.combinedMinimumSize(child);
    const w = Math.trunc(ms.x);
    const h = Math.trunc(ms.y);
    colMinW.set(col, Math.max(colMinW.get(col) ?? 0, w));
    rowMinH.set(row, Math.max(rowMinH.get(row) ?? 0, h));
    maxColIndex = Math.max(maxColIndex, col);
    maxRowIndex = Math.max(maxRowIndex, row);
  }

  let width = 0;
  for (const w of colMinW.values()) width += w;
  let height = 0;
  for (const h of rowMinH.values()) height += h;

  width += separationOf(n, 'h_separation', ctx.theme) * maxColIndex;
  height += separationOf(n, 'v_separation', ctx.theme) * maxRowIndex;

  return { x: width, y: height };
};

controlSolverRegistry.registerMinimumSize('GridContainer', gridContainerMinimumSize);

// --- fit_child_in_rect + the universal minimum-size floor ---------------------



/**
 * Evicts the expanded index (column or row) with the largest own minimum
 * whenever an equal division of `remaining` among the survivors can't
 * satisfy every one of them, repeating until it can or none are left
 * (`grid_container.cpp:100-119`/`:121-140`, the column and row copies of the
 * SAME loop shape). Ties keep the LOWEST index — ascending iteration order,
 * `front()`'s initial candidate, and a strict `>` comparison that never
 * displaces it on an exact tie, mirroring the RBSet/RBMap iteration order the
 * C++ relies on.
 */
function evictUnfittable(expanded: Set<number>, minOf: ReadonlyMap<number, number>, remaining: number): number {
  let space = remaining;
  let canFit = false;

  while (!canFit && expanded.size > 0) {
    canFit = true;
    const ordered = [...expanded].sort((a, b) => a - b);
    let maxIndex = ordered[0]!;
    for (const idx of ordered) {
      const w = minOf.get(idx) ?? 0;
      if (w > (minOf.get(maxIndex) ?? 0)) maxIndex = idx;
      if (canFit && space / expanded.size < w) canFit = false;
    }
    if (!canFit) {
      expanded.delete(maxIndex);
      space -= minOf.get(maxIndex) ?? 0;
    }
  }

  return space;
}

/** How many of the leading `usedCount` expanded indices absorb one extra pixel of `remainingPixel` (`grid_container.cpp:162-182`). Returns the count, not a set — every index below it gets +1. */
function remainingPixelIndex(expanded: ReadonlySet<number>, usedCount: number, remainingPixel: number): number {
  let index = 0;
  let remaining = remainingPixel;
  for (let i = 0; i < usedCount; i++) {
    if (remaining === 0) break;
    if (expanded.has(i)) {
      index = i + 1;
      remaining--;
    }
  }
  return index;
}

/**
 * `GridContainer::_notification`'s `NOTIFICATION_SORT_CHILDREN`
 * (`grid_container.cpp:36-230`): computes each column's max width and each
 * row's max height, decides which columns/rows expand (any child with the
 * `SIZE_EXPAND` flag on that axis — plus, for columns only, every column past
 * the last one actually used when there are fewer children than `columns`,
 * "consider all empty columns expanded", `:79-82` — rows have no such phantom
 * since a grid's row count is never fixed independent of its content the way
 * `columns` is), evicts any expanded column/row whose own minimum can't fit
 * an equal share of the remaining space, then walks every child assigning its
 * cell and running it through `fit_child_in_rect` + the minimum-size floor
 * above.
 */
export const gridContainerLayout: ContainerLayoutFn = (n, children, contentRect, ctx) => {
  const columns = columnsOf(n);
  const hSep = separationOf(n, 'h_separation', ctx.theme);
  const vSep = separationOf(n, 'v_separation', ctx.theme);

  const sortable = children.filter(({ node }) => isSortableControl(node));
  const validCount = sortable.length;

  const colMinW = new Map<number, number>();
  const rowMinH = new Map<number, number>();
  const colExpanded = new Set<number>();
  const rowExpanded = new Set<number>();

  sortable.forEach(({ node: child, minSize }, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    colMinW.set(col, Math.max(colMinW.get(col) ?? 0, Math.trunc(minSize.x)));
    rowMinH.set(row, Math.max(rowMinH.get(row) ?? 0, Math.trunc(minSize.y)));
    if (hasFlag(hFlagsOf(child), SIZE_EXPAND)) colExpanded.add(col);
    if (hasFlag(vFlagsOf(child), SIZE_EXPAND)) rowExpanded.add(row);
  });

  const usedColumnCount = Math.min(validCount, columns);
  const usedRowCount = validCount === 0 ? 0 : Math.ceil(validCount / columns);

  for (let i = validCount; i < columns; i++) colExpanded.add(i);

  let remainingWidth = contentRect.w;
  for (const [col, w] of colMinW) {
    if (!colExpanded.has(col)) remainingWidth -= w;
  }
  remainingWidth -= hSep * Math.max(usedColumnCount - 1, 0);

  let remainingHeight = contentRect.h;
  for (const [row, h] of rowMinH) {
    if (!rowExpanded.has(row)) remainingHeight -= h;
  }
  remainingHeight -= vSep * Math.max(usedRowCount - 1, 0);

  remainingWidth = evictUnfittable(colExpanded, colMinW, remainingWidth);
  remainingHeight = evictUnfittable(rowExpanded, rowMinH, remainingHeight);

  let colExpand = 0;
  let colRemainingPixel = 0;
  if (colExpanded.size > 0) {
    colExpand = Math.trunc(remainingWidth / colExpanded.size);
    // `int col_remaining_pixel` (`grid_container.cpp:147`) — the remainder of a
    // FLOAT `remaining_space` truncates too, so a fractional leftover never
    // becomes an extra distributed pixel.
    colRemainingPixel = Math.trunc(remainingWidth - colExpanded.size * colExpand);
  }

  let rowExpand = 0;
  let rowRemainingPixel = 0;
  if (rowExpanded.size > 0) {
    rowExpand = Math.trunc(remainingHeight / rowExpanded.size);
    rowRemainingPixel = Math.trunc(remainingHeight - rowExpanded.size * rowExpand);
  }

  const colRemainingPixelIndex = remainingPixelIndex(colExpanded, usedColumnCount, colRemainingPixel);
  const rowRemainingPixelIndex = remainingPixelIndex(rowExpanded, usedRowCount, rowRemainingPixel);

  const rects = new Map<string, Rect2>();
  let colOfs = 0;
  let rowOfs = 0;

  sortable.forEach(({ node: child, minSize }, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;

    if (col === 0) {
      colOfs = 0;
      if (row > 0) {
        const prevRow = row - 1;
        rowOfs += (rowExpanded.has(prevRow) ? rowExpand : rowMinH.get(prevRow) ?? 0) + vSep;
        if (rowExpanded.has(prevRow) && prevRow < rowRemainingPixelIndex) rowOfs += 1;
      }
    }

    let w = colExpanded.has(col) ? colExpand : colMinW.get(col) ?? 0;
    let h = rowExpanded.has(row) ? rowExpand : rowMinH.get(row) ?? 0;
    if (colExpanded.has(col) && col < colRemainingPixelIndex) w += 1;
    if (rowExpanded.has(row) && row < rowRemainingPixelIndex) h += 1;

    const cell: Rect2 = { x: colOfs, y: rowOfs, w, h };
    // No local minimum re-floor: the solver core applies `Control::set_rect`'s
    // floor (grow direction included) to every rect a container returns, so
    // doing it here too would be a second copy of the same rule to keep in sync.
    rects.set(child.path, fitChildInRect(cell, minSize, hFlagsOf(child), vFlagsOf(child)));

    colOfs += w + hSep;
  });

  return rects;
};

controlSolverRegistry.registerContainerLayout('GridContainer', gridContainerLayout);
