/**
 * GraphEdit's native (WebGL canvas) rect solve — `GraphEdit::_update_scroll_offset`
 * (`scene/gui/graph_edit.cpp:435-462`), the ONLY place Godot positions a
 * GraphElement child: `set_position(position_offset * zoom - scroll_offset)`,
 * `set_scale(Vector2(zoom, zoom))`.
 *
 * `GraphEdit` is a plain `Control`, not a `Container` (`graph_edit.h:114`) —
 * this registration exists only because our own solver has no OTHER way to
 * hand a child a computed position outside the free/anchored path. Doing so
 * has one unavoidable cost: `ControlCanvasWalker`'s `isFreeParent` gate forces
 * EVERY child of a registered container to scale=1/rotation=0
 * (`ControlCanvasWalker.tsx:210-216`), so the `set_scale(zoom, zoom)` half of
 * the port above is NOT reachable from this slice without editing that
 * (forbidden) file. Only the POSITION half is implemented; at `zoom = 1`
 * (the property's own default) this is exact. See `Component.tsx`'s own doc
 * for the matching gap on the DRAW side.
 *
 * A child that is NOT a GraphElement (`GraphNode`/`GraphFrame`, or a bare
 * `GraphElement`) is never touched by `_update_scroll_offset`'s own
 * `Object::cast_to<GraphElement>` guard (`:441-444`) and instead resolves as
 * an ordinary free/anchored Control against GraphEdit's own rect — ported
 * here via `resolveControlLayout` (`r3f/controls/controlAnchors.ts`) plus the
 * one-line anchor formula (`Control::_size_changed`,
 * `scene/gui/control.cpp:1531-1541`: `edge_pos[i] = offset[i] + anchor[i] *
 * area`), since a registered container's children never reach the
 * OTHERWISE-automatic free/anchored path at all
 * (`controlRectSolver.ts`'s own doc).
 *
 * No `MinimumSizeFn` is registered: `GraphEdit` overrides no
 * `get_minimum_size` (confirmed against the source — the brief that
 * commissioned this slice named one; it does not exist), so it is left
 * unregistered, matching Godot's own `Control::get_minimum_size` default of
 * `(0, 0)`.
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

/**
 * `GraphEdit::_update_scroll_offset` (`:435-462`), position only —
 * this module's own doc for the unreachable `set_scale(zoom, zoom)` half.
 */
export const graphEditLayout: ContainerLayoutFn = (n, children, contentRect, ctx) => {
  const props = n.node.properties as GraphEditProperties;
  const zoom = props.zoom ?? 1;
  const scrollOffset = props.scrollOffset ?? { x: 0, y: 0 };

  const rects = new Map<string, Rect2>();
  for (const { node: child } of children) {
    const childProps = child.node.properties as ControlProperties;
    const layout = resolveControlLayout(childProps, controlLayoutOrder(child), () => ctx.combinedMinimumSize(child));
    // `Control::set_position(pos)` (no `keep_offsets`) re-derives the offsets
    // from the NEW position against the CURRENT anchors/size, so the anchored
    // rect's own width/height survive untouched — only x/y are overwritten
    // below for a GraphElement child. `dispatchChildren` re-floors this
    // against the child's own minimum size afterward (solverRegistry.ts's
    // own doc), so no floor is applied here.
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
