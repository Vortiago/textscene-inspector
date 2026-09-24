/**
 * CenterContainer's native (WebGL canvas) layout solver, a port of `get_minimum_size` and
 * `NOTIFICATION_SORT_CHILDREN` (`scene/gui/center_container.cpp`) with the shared
 * `Container::fit_child_in_rect` (`scene/gui/container.cpp:95-128`). `use_top_left`
 * (`center_container.h:38`) changes both halves.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { ContainerLayoutFn, MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import type { CenterContainerProperties } from './types';
import { SIZE_FILL, fitChildInRect, isSortableControl } from '../shared/fitChildInRect';

// Control::SizeFlags (control.h:78-85). The flags never change this container's result,
// since `fit_child_in_rect` (container.cpp:95-128) receives the child's minimum size.
const DEFAULT_SIZE_FLAGS = SIZE_FILL;

function props(n: SolveNode): CenterContainerProperties {
  return n.node.properties as CenterContainerProperties;
}

/**
 * `CenterContainer::get_minimum_size` (`center_container.cpp:33-48`):
 * `(0, 0)` when `use_top_left`, else the componentwise max of every visible
 * child's own combined minimum size (`Size2::max`).
 */
export const centerContainerMinimumSize: MinimumSizeFn = (n, ctx) => {
  if (props(n).useTopLeft === true) return { x: 0, y: 0 };

  let maxW = 0;
  let maxH = 0;
  for (const child of n.children) {
    if (!isSortableControl(child)) continue;
    const s = ctx.combinedMinimumSize(child);
    if (s.x > maxW) maxW = s.x;
    if (s.y > maxH) maxH = s.y;
  }
  return { x: maxW, y: maxH };
};

/**
 * `NOTIFICATION_SORT_CHILDREN` (`center_container.cpp:73-88`): each visible child is centred on
 * its own combined minimum size, independently of its siblings, on the container's rect or,
 * under `use_top_left`, on its top-left corner. Only `contentRect.w` and `.h` count: `.x` and `.y`
 * are this node's parent-relative position, and a child's rect is relative to this node.
 */
export const centerContainerLayout: ContainerLayoutFn = (n, children, contentRect, _ctx) => {
  const useTopLeft = props(n).useTopLeft === true;

  const out = new Map<string, Rect2>();
  for (const { node: child, minSize } of children) {
    if (!isSortableControl(child)) continue;
    // center_container.cpp:83-84: half the spare size, or half the negated minimum under
    // `use_top_left`, floored.
    const ofsX = useTopLeft ? Math.floor(-minSize.x * 0.5) : Math.floor((contentRect.w - minSize.x) / 2);
    const ofsY = useTopLeft ? Math.floor(-minSize.y * 0.5) : Math.floor((contentRect.h - minSize.y) / 2);

    const cp = child.node.properties as CenterContainerProperties;
    const hFlags = cp.sizeFlagsHorizontal ?? DEFAULT_SIZE_FLAGS;
    const vFlags = cp.sizeFlagsVertical ?? DEFAULT_SIZE_FLAGS;
    // `Rect2(ofs, minsize)` is already the child's minimum size (center_container.cpp:84),
    // so FILL is a no-op: a child cannot grow to fill a CenterContainer.
    out.set(
      child.path,
      // Every RTL term inside (`container.cpp:99,109`) is zero here, and
      // `center_container.cpp` never calls `is_layout_rtl()`. Godot still reads the flag.
      fitChildInRect({ x: ofsX, y: ofsY, w: minSize.x, h: minSize.y }, minSize, hFlags, vFlags, n.rtl)
    );
  }
  return out;
};
