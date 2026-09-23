/**
 * GraphEdit's native (WebGL canvas) rect solve: `GraphEdit::_update_scroll_offset`
 * (`scene/gui/graph_edit.cpp:435-462`), the only place Godot positions a GraphElement child, with
 * `set_position(position_offset * zoom - scroll_offset)`. No `MinimumSizeFn` is registered:
 * `GraphEdit` overrides no `get_minimum_size`, so `Control`'s `(0, 0)` holds.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { ControlProperties } from '../control/types';
import type { GraphElementProperties } from '../graphelement/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import { controlSolverRegistry, type ContainerLayoutFn } from '../../../../r3f/controls/native/solverRegistry';
import { controlLayoutOrder } from '../../../../r3f/controls/native/solveTree';
import { resolveControlLayout } from '../../../../r3f/controls/controlAnchors';
import type { GraphEditProperties } from './types';

const GRAPH_ELEMENT_TYPES = new Set(['GraphElement', 'GraphNode', 'GraphFrame']);

/** `Control::_size_changed`'s anchor formula (`control.cpp:1531-1541`): `edge_pos[i] = offset[i] + anchor[i] * area`, area being the parent's own width/height. */
function anchoredRect(
  anchors: readonly [number, number, number, number],
  offsets: readonly [number, number, number, number],
  parentRect: Rect2
): Rect2 {
  const left = offsets[0] + anchors[0] * parentRect.w;
  const top = offsets[1] + anchors[1] * parentRect.h;
  const right = offsets[2] + anchors[2] * parentRect.w;
  const bottom = offsets[3] + anchors[3] * parentRect.h;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/**
 * `GraphEdit::_update_scroll_offset` (`:435-462`), position half only: GraphEdit is a plain `Control`
 * (`graph_edit.h:114`) registered as a container to place its children, and `ControlCanvasWalker`
 * then forces each child to scale 1 and rotation 0 (`ControlCanvasWalker.tsx:210-216`). Exact at the
 * default `zoom = 1`. `Component.tsx` has the matching gap.
 */
export const graphEditLayout: ContainerLayoutFn = (n, children, contentRect, ctx) => {
  const props = n.node.properties as GraphEditProperties;
  const zoom = props.zoom ?? 1;
  const scrollOffset = props.scrollOffset ?? { x: 0, y: 0 };

  const rects = new Map<string, Rect2>();
  for (const { node: child } of children) {
    const childProps = child.node.properties as ControlProperties;
    const layout = resolveControlLayout(childProps, controlLayoutOrder(child), () => ctx.combinedMinimumSize(child));
    // `Control::set_position(pos)` (no `keep_offsets`) keeps the anchored width
    // and height, so a GraphElement child overwrites only x/y below.
    // `dispatchChildren` floors the rect at the child's minimum size afterwards
    // (solverRegistry.ts), so no floor applies here.
    const natural = anchoredRect(layout.anchors, layout.offsets, contentRect);

    if (GRAPH_ELEMENT_TYPES.has(child.node.type)) {
      const positionOffset = (child.node.properties as GraphElementProperties).positionOffset ?? { x: 0, y: 0 };
      rects.set(child.path, {
        x: positionOffset.x * zoom - scrollOffset.x,
        y: positionOffset.y * zoom - scrollOffset.y,
        w: natural.w,
        h: natural.h,
      });
    } else {
      // `_update_scroll_offset` skips a non-GraphElement (`:441-444`), so it keeps its anchored rect.
      // A registered container's child never reaches `controlRectSolver.ts`'s own anchored path.
      rects.set(child.path, natural);
    }
  }
  return rects;
};

controlSolverRegistry.registerContainerLayout('GraphEdit', graphEditLayout);
