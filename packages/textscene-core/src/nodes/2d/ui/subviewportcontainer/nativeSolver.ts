/**
 * SubViewportContainer's native minimum size, `SubViewportContainer::get_minimum_size`
 * (`scene/gui/subviewport_container.cpp`): zero under `stretch`, else the largest SubViewport child's
 * `size`. No container layout is registered: the child that matters is a `SubViewport`, not a
 * Control, so a `ContainerLayoutFn` would claim children Godot does not manage.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import { isViewportBoundary } from '../../../viewport/subviewport/viewportBoundary';
import type { SubViewportProperties } from '../../../viewport/subviewport/types';
import { viewportSize } from '../../../viewport/subviewport/targetSize';
import type { SubViewportContainerProperties } from './types';

export const subViewportContainerMinimumSize: MinimumSizeFn = (n) => {
  const props = n.node.properties as SubViewportContainerProperties;
  // `stretch_shrink` never enters here: it divides the rect `recalc_force_viewport_sizes` forces,
  // and a stretching container has no minimum size at all.
  if (props.stretch === true) return { x: 0, y: 0 };

  let width = 0;
  let height = 0;
  // `buildSolveTree` strips a viewport boundary from `SolveNode.children` (ADR-0033), so the raw
  // children, which Godot's `get_child_count()` loop reads too, are the only place it exists.
  for (const child of n.node.children) {
    // `Object::cast_to<SubViewport>`: every other child kind is skipped.
    if (!isViewportBoundary(child.type)) continue;
    // `c->get_size()`: no container forces a size here, so it is the authored one, floored.
    const size = viewportSize((child.properties as SubViewportProperties).size, null);
    if (size.x > width) width = size.x;
    if (size.y > height) height = size.y;
  }
  return { x: width, y: height };
};
