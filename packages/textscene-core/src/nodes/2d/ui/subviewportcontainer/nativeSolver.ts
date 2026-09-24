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
import type { SubViewportContainerProperties } from './types';

export const subViewportContainerMinimumSize: MinimumSizeFn = (n) => {
  const props = n.node.properties as SubViewportContainerProperties;
  // `stretch_shrink` divides the solved rect downstream (`recalc_force_viewport_sizes`), so a
  // shrinking container still floors at the sub-viewport's full size.
  if (props.stretch === true) return { x: 0, y: 0 };

  let width = 0;
  let height = 0;
  // `buildSolveTree` strips a viewport boundary from `SolveNode.children` (ADR-0033), so the raw
  // children, which Godot's `get_child_count()` loop reads too, are the only place it exists.
  for (const child of n.node.children) {
    // `Object::cast_to<SubViewport>`: every other child kind is skipped.
    if (!isViewportBoundary(child.type)) continue;
    // Never undefined: `subviewport/parser.ts` applies Godot's own 512x512
    // default (`scene/main/viewport.h`) to every parsed SubViewport.
    const size = (child.properties as SubViewportProperties).size;
    if (size.x > width) width = size.x;
    if (size.y > height) height = size.y;
  }
  return { x: width, y: height };
};
