/**
 * GridContainer's native (WebGL canvas) rect solve: a port of
 * `GridContainer::_notification`'s `NOTIFICATION_SORT_CHILDREN` handler and
 * `GridContainer::get_minimum_size` (`scene/gui/grid_container.cpp`), plus
 * the shared `Container::fit_child_in_rect` (`scene/gui/container.cpp:95-128`)
 * every container child goes through.
 *
 * `fit_child_in_rect` ends in `Control::set_rect`/`Control::_size_changed`
 * (`scene/gui/control.cpp:1531-
 * 1541,1760-1797`), which floors the rect at the child's full-precision
 * `get_combined_minimum_size()`, as `native/controlRectSolver.ts` does for the
 * free/anchored path (`GROW_DIRECTION_*`).
 * The grid truncates each child minimum to `Size2i` (`grid_container.cpp:290`), so
 * a fractional minimum outgrows its cell: `Vector2(10.7, 5)` in a 10-wide column
 * is 10.7 wide, and `grow_horizontal = 0` (`GROW_DIRECTION_BEGIN`) shifts x by -0.7.
 *
 * Under RTL each row starts at the trailing edge and walks back
 * (`grid_container.cpp:157,190-194,220-228`), and `fit_child_in_rect` gets the
 * flag too. Column indices do not change, so the empty expanded columns past
 * the last used one keep the high indices.
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

/** `Control` defaults both axes to `SIZE_FILL` (`control.h:229-230`, flags at `control.h:79-85`). A parser that overrides a flag, as Label's `v_size_flags`, bakes it into the parsed properties. */
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
 * `GridContainer::get_minimum_size` (`grid_container.cpp:273-320`): the per-column
 * max widths plus `h_separation` times `max_col`, the 0-based last used column
 * (a count in `_resort`), and the same for rows. Each child minimum truncates to
 * `Size2i` (`:290`) first.
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
 * Evicts the expanded column or row with the largest minimum until an equal
 * share of `remaining` fits each survivor (`grid_container.cpp:100-119`/`:121-140`).
 * A tie keeps the lowest index, as the C++ RBSet's ascending order, `front()` and
 * a strict `>` do.
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

/** How many of the leading `usedCount` expanded indices absorb one extra pixel of `remainingPixel` (`grid_container.cpp:162-182`). Returns the count, not a set: every index below it gets +1. */
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
 * `NOTIFICATION_SORT_CHILDREN` (`grid_container.cpp:36-230`). A column or row
 * expands when a child sets `SIZE_EXPAND` on that axis. Each column past the last
 * used one expands too ("consider all empty columns expanded", `:79-82`); rows
 * have no fixed count, so none do. Then `evictUnfittable`, then `fit_child_in_rect`.
 */
export const gridContainerLayout: ContainerLayoutFn = (n, children, contentRect, ctx) => {
  const columns = columnsOf(n);
  const rtl = n.rtl;
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
    // `int col_remaining_pixel` (`grid_container.cpp:147`): the remainder of a
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
      // `col_ofs = get_size().width` under RTL (`grid_container.cpp:190-194`);
      // this container insets nothing, so its content rect is its own size.
      colOfs = rtl ? contentRect.w : 0;
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

    const cell: Rect2 = { x: rtl ? colOfs - w : colOfs, y: rowOfs, w, h };
    // No local minimum re-floor: the solver core applies `Control::set_rect`'s
    // floor (grow direction included) to every rect a container returns, so
    // doing it here too would be a second copy of the same rule to keep in sync.
    rects.set(child.path, fitChildInRect(cell, minSize, hFlagsOf(child), vFlagsOf(child), rtl));

    colOfs += rtl ? -(w + hSep) : w + hSep;
  });

  return rects;
};

controlSolverRegistry.registerContainerLayout('GridContainer', gridContainerLayout);
