/**
 * GraphEdit's native (WebGL canvas) rect solve: `GraphEdit::_update_scroll_offset`
 * (`scene/gui/graph_edit.cpp:435-462`), the only place Godot positions a
 * GraphElement child: `set_position(position_offset * zoom - scroll_offset)`,
 * `set_scale(Vector2(zoom, zoom))`.
 *
 * `GraphEdit` is a plain `Control`, not a `Container` (`graph_edit.h:114`). It
 * registers as one only so the solver can hand a child a computed position.
 * The cost: `ControlCanvasWalker`'s `isFreeParent` gate forces each child of a
 * registered container to scale=1/rotation=0 (`ControlCanvasWalker.tsx:210-216`),
 * so only the position half is ported, which is exact at the default `zoom = 1`.
 * `Component.tsx` has the matching gap on the draw side.
 *
 * A child that is not a GraphElement skips `_update_scroll_offset`'s
 * `Object::cast_to<GraphElement>` guard (`:441-444`) and resolves as an ordinary
 * free/anchored Control against GraphEdit's rect, through `resolveControlLayout`
 * and `anchoredRect` (`scene/gui/control.cpp:1531-1541`): a registered
 * container's children never reach the automatic free/anchored path
 * (`controlRectSolver.ts`).
 *
 * No `MinimumSizeFn` is registered: `GraphEdit` overrides no `get_minimum_size`,
 * so Godot's `Control::get_minimum_size` default of `(0, 0)` holds.
 *
 * Pure data + functions, no React, no THREE.
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

/** `GraphEdit::_update_scroll_offset` (`:435-462`), position half only. */
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
      rects.set(child.path, natural);
    }
  }
  return rects;
};

controlSolverRegistry.registerContainerLayout('GraphEdit', graphEditLayout);
