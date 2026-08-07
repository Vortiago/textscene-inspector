/**
 * SubViewportContainer's native (WebGL canvas) minimum size — a port of
 * `SubViewportContainer::get_minimum_size`
 * (`scene/gui/subviewport_container.cpp`):
 *
 *     Size2 SubViewportContainer::get_minimum_size() const {
 *         if (stretch) { return Size2(); }
 *         Size2 ms;
 *         for (int i = 0; i < get_child_count(); i++) {
 *             SubViewport *c = Object::cast_to<SubViewport>(get_child(i));
 *             if (!c) { continue; }
 *             Size2 minsize = c->get_size();
 *             ms = ms.max(minsize);
 *         }
 *         return ms;
 *     }
 *
 * There is no container layout half. A SubViewportContainer imposes no rect on
 * anything — its only child that matters is a `SubViewport`, which is not a
 * Control and never appears in the solve at all — so registering a
 * `ContainerLayoutFn` here would only tell the walker and the solver that this
 * node's (nonexistent) Control children are container-managed, which is a
 * different claim from the one Godot makes.
 *
 * WHY THIS READS `node.children` AND NOT `children`. `buildSolveTree` strips a
 * viewport boundary out of the `SolveNode` forest (a sub-viewport's subtree is
 * dispatched by the surface painter, ADR-0033), so `SolveNode.children` is
 * always EMPTY here and the raw parsed children are the only place the
 * sub-viewports still exist. Godot's own loop is over `get_child_count()`,
 * i.e. the raw tree, for the same reason.
 *
 * `stretch_shrink` deliberately does not enter this. It divides the CONTAINER's
 * already-solved rect (`recalc_force_viewport_sizes`), which is downstream of
 * the minimum size, not an input to it — a shrinking container still floors at
 * the sub-viewport's full authored size.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Vec2 } from '../../../../r3f/controls/native/rect';
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import { isViewportBoundary } from '../../../viewport/subviewport/viewportBoundary';
import type { SubViewportProperties } from '../../../viewport/subviewport/types';
import type { SubViewportContainerProperties } from './types';

/** `Viewport`'s own default target size — `scene/main/viewport.h`: `Size2i size = Size2i(512, 512)`. */
const DEFAULT_SUB_VIEWPORT_SIZE: Vec2 = { x: 512, y: 512 };

export const subViewportContainerMinimumSize: MinimumSizeFn = (n) => {
  const props = n.node.properties as SubViewportContainerProperties;
  if (props.stretch === true) return { x: 0, y: 0 };

  let width = 0;
  let height = 0;
  for (const child of n.node.children) {
    // `Object::cast_to<SubViewport>` — every other child kind is skipped.
    if (!isViewportBoundary(child.type)) continue;
    const size = (child.properties as SubViewportProperties).size ?? DEFAULT_SUB_VIEWPORT_SIZE;
    if (size.x > width) width = size.x;
    if (size.y > height) height = size.y;
  }
  return { x: width, y: height };
};
