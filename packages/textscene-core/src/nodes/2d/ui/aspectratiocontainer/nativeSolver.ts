/**
 * AspectRatioContainer's native (WebGL canvas) layout solver — a port of
 * `AspectRatioContainer::get_minimum_size` and its `NOTIFICATION_SORT_CHILDREN`
 * handler (`scene/gui/aspect_ratio_container.cpp`), plus the shared
 * `Container::fit_child_in_rect` (`scene/gui/container.cpp:95-128`) it calls.
 *
 * Unlike CenterContainer/GridContainer, EVERY child gets its own rect here —
 * there is no "first child only" special case: `_notification` loops
 * `get_child_count()` exactly like `get_minimum_size` does
 * (`aspect_ratio_container.cpp:98-173`), fitting each child independently into
 * the SAME container-relative rect computed from `ratio`/`stretch_mode`.
 *
 * A TextureRect child with a `PROPORTIONAL` fit expand mode is skipped
 * entirely (`:109-116`, Godot's own "Temporary fix for editor crash" —
 * `WARN_PRINT_ONCE("Proportional TextureRect is currently not supported
 * inside AspectRatioContainer")`) — this solver never assigns it a rect,
 * which `controlRectSolver.ts`'s `dispatchChildren` floors to `(0,0,0,0)`.
 *
 * All-float (`Size2`, not `Size2i`) — unlike GridContainer/FlowContainer,
 * nothing here truncates.
 *
 * RTL out of scope (`native/controlRectSolver.ts`'s own note).
 *
 * Pure data + functions, no React, no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import {
  controlSolverRegistry,
  type ContainerLayoutFn,
  type MinimumSizeFn,
} from '../../../../r3f/controls/native/solverRegistry';
import type { AspectRatioContainerProperties } from './types';
import type { TextureRectProperties } from '../texturerect/types';
import { SIZE_FILL, fitChildInRect, isSortableControl } from '../shared/fitChildInRect';

// AspectRatioContainer::StretchMode (aspect_ratio_container.h:44-49).
const STRETCH_WIDTH_CONTROLS_HEIGHT = 0;
const STRETCH_HEIGHT_CONTROLS_WIDTH = 1;
const STRETCH_FIT = 2;
const STRETCH_COVER = 3;

// AspectRatioContainer::AlignmentMode (aspect_ratio_container.h:50-54).
const ALIGNMENT_BEGIN = 0;
const ALIGNMENT_CENTER = 1;
const ALIGNMENT_END = 2;

// TextureRect::ExpandMode (texture_rect.h:40-45) — the two PROPORTIONAL modes.
const EXPAND_FIT_WIDTH_PROPORTIONAL = 3;
const EXPAND_FIT_HEIGHT_PROPORTIONAL = 5;

const DEFAULT_SIZE_FLAGS = SIZE_FILL;

function props(n: SolveNode): AspectRatioContainerProperties {
  return n.node.properties as AspectRatioContainerProperties;
}

/** `aspect_ratio_container.cpp:109-116` — see module doc. */
function isUnsupportedTextureRect(child: SolveNode): boolean {
  if (child.node.type !== 'TextureRect') return false;
  const mode = (child.node.properties as TextureRectProperties).expandMode;
  return mode === EXPAND_FIT_WIDTH_PROPORTIONAL || mode === EXPAND_FIT_HEIGHT_PROPORTIONAL;
}

/**
 * `AspectRatioContainer::get_minimum_size` (`aspect_ratio_container.cpp:35-46`):
 * componentwise max of every visible child's own combined minimum size —
 * `ratio`/`stretch_mode`/alignment play no part in the container's OWN floor.
 */
export const aspectRatioContainerMinimumSize: MinimumSizeFn = (n, ctx) => {
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

controlSolverRegistry.registerMinimumSize('AspectRatioContainer', aspectRatioContainerMinimumSize);

/**
 * `AspectRatioContainer::_notification`'s `NOTIFICATION_SORT_CHILDREN`
 * (`aspect_ratio_container.cpp:98-173`): each child's target size is
 * `(ratio, 1.0)` scaled by a factor derived from `stretch_mode` against the
 * container's own full size, then floored to the child's own combined
 * minimum (`:136-137`), then aligned inside the container per
 * `alignment_horizontal`/`alignment_vertical` (`:139-163`). `fit_child_in_rect`
 * (shared) applies the child's OWN size flags on top — a child without
 * `SIZE_FILL` ends up at its own minimum inside this rect regardless of the
 * aspect-derived size, exactly as every other container's fit-in-rect call.
 */
export const aspectRatioContainerLayout: ContainerLayoutFn = (n, children, contentRect, _ctx) => {
  const p = props(n);
  const ratio = p.ratio ?? 1.0;
  const stretchMode = p.stretchMode ?? STRETCH_FIT;
  const alignH = p.alignmentHorizontal ?? ALIGNMENT_CENTER; // aspect_ratio_container.h:59
  const alignV = p.alignmentVertical ?? ALIGNMENT_CENTER; // aspect_ratio_container.h:60

  const size = { x: contentRect.w, y: contentRect.h };
  const baseW = ratio;
  const baseH = 1.0;

  const out = new Map<string, Rect2>();
  for (const { node: child, minSize } of children) {
    if (!isSortableControl(child)) continue;
    if (isUnsupportedTextureRect(child)) continue;

    let scaleFactor = 1.0;
    switch (stretchMode) {
      case STRETCH_WIDTH_CONTROLS_HEIGHT:
        scaleFactor = size.x / baseW;
        break;
      case STRETCH_HEIGHT_CONTROLS_WIDTH:
        scaleFactor = size.y / baseH;
        break;
      case STRETCH_FIT:
        scaleFactor = Math.min(size.x / baseW, size.y / baseH);
        break;
      case STRETCH_COVER:
        scaleFactor = Math.max(size.x / baseW, size.y / baseH);
        break;
      default:
        // No case matches an out-of-range value (:122-135 has no default
        // branch), so scale_factor keeps its initialized 1.0.
        break;
    }

    const childW = Math.max(baseW * scaleFactor, minSize.x);
    const childH = Math.max(baseH * scaleFactor, minSize.y);

    const alignX = alignH === ALIGNMENT_BEGIN ? 0 : alignH === ALIGNMENT_END ? 1 : 0.5;
    const alignY = alignV === ALIGNMENT_BEGIN ? 0 : alignV === ALIGNMENT_END ? 1 : 0.5;

    const offsetX = (size.x - childW) * alignX;
    const offsetY = (size.y - childH) * alignY;

    const cp = child.node.properties as AspectRatioContainerProperties;
    const hFlags = cp.sizeFlagsHorizontal ?? DEFAULT_SIZE_FLAGS;
    const vFlags = cp.sizeFlagsVertical ?? DEFAULT_SIZE_FLAGS;

    out.set(
      child.path,
      fitChildInRect({ x: offsetX, y: offsetY, w: childW, h: childH }, minSize, hFlags, vFlags)
    );
  }
  return out;
};

controlSolverRegistry.registerContainerLayout('AspectRatioContainer', aspectRatioContainerLayout);
