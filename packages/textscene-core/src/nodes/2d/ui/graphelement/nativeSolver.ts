/**
 * GraphElement's native (WebGL canvas) rect solve: `GraphElement::_resort` and `get_minimum_size`
 * (`scene/gui/graph_element.cpp:47-73`), with `Container::fit_child_in_rect` (`scene/gui/container.cpp:95-128`).
 * GraphNode and GraphFrame override `_resort` in their own `nativeSolver.ts`, so this registration
 * runs only for a bare `GraphElement`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { ControlProperties } from '../control/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import {
  controlSolverRegistry,
  type ContainerLayoutFn,
  type MinimumSizeFn,
} from '../../../../r3f/controls/native/solverRegistry';
import { SIZE_FILL, fitChildInRect, isSortableControl } from '../shared/fitChildInRect';

const DEFAULT_SIZE_FLAGS = SIZE_FILL;

function hFlagsOf(n: SolveNode): number {
  return (n.node.properties as ControlProperties).sizeFlagsHorizontal ?? DEFAULT_SIZE_FLAGS;
}

function vFlagsOf(n: SolveNode): number {
  return (n.node.properties as ControlProperties).sizeFlagsVertical ?? DEFAULT_SIZE_FLAGS;
}

/**
 * `GraphElement::get_minimum_size` (`:59-73`): the max, per axis, of every
 * child's combined minimum size: hidden children included
 * (`SortableVisibilityMode::IGNORE`, `:62`).
 */
export const graphElementMinimumSize: MinimumSizeFn = (n, ctx) => {
  let width = 0;
  let height = 0;
  for (const child of n.children) {
    const size = ctx.combinedMinimumSize(child);
    width = Math.max(width, size.x);
    height = Math.max(height, size.y);
  }
  return { x: width, y: height };
};

controlSolverRegistry.registerMinimumSize('GraphElement', graphElementMinimumSize);

/**
 * `GraphElement::_resort` (`:47-57`): every visible child (`VISIBLE_IN_TREE`, `:51`) fitted into this
 * node's own full rect, with no chrome and no margin. `graph_element.cpp` calls `is_layout_rtl()`
 * nowhere, but the container's flag still reaches a child through `fit_child_in_rect`.
 */
export const graphElementLayout: ContainerLayoutFn = (n, children, contentRect) => {
  const rects = new Map<string, Rect2>();
  for (const { node: child, minSize } of children) {
    if (!isSortableControl(child)) continue;
    rects.set(child.path, fitChildInRect(contentRect, minSize, hFlagsOf(child), vFlagsOf(child), n.rtl));
  }
  return rects;
};

controlSolverRegistry.registerContainerLayout('GraphElement', graphElementLayout);
