/**
 * AspectRatioContainer's native (WebGL canvas) layout solver, a port of `get_minimum_size`,
 * `NOTIFICATION_SORT_CHILDREN` (`scene/gui/aspect_ratio_container.cpp`) and the shared
 * `Container::fit_child_in_rect` (`scene/gui/container.cpp:95-128`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from '../../../../godot/math/rect2';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import {
  controlSolverRegistry,
  type ContainerLayoutFn,
  type MinimumSizeFn,
} from '../../../../r3f/controls/native/solverRegistry';
import type { AspectRatioContainerProperties } from './types';
import type { TextureRectProperties } from '../texturerect/types';
import { fitChildInRect, isSortableControl } from '../shared/fitChildInRect';
import { ContainerAlignment } from '../../../../godot/scene/container';
import { DEFAULT_SIZE_FLAGS } from '../../../../godot/scene/control';
import { AspectRatioStretchMode, TextureRectExpandMode } from '../../../../godot/scene/gui';

function props(n: SolveNode): AspectRatioContainerProperties {
  return n.node.properties as AspectRatioContainerProperties;
}

/** A proportional TextureRect child, which the sort skips (`aspect_ratio_container.cpp:109-116`). */
function isUnsupportedTextureRect(child: SolveNode): boolean {
  if (child.node.type !== 'TextureRect') return false;
  const mode = (child.node.properties as TextureRectProperties).expandMode;
  return (
    mode === TextureRectExpandMode.EXPAND_FIT_WIDTH_PROPORTIONAL ||
    mode === TextureRectExpandMode.EXPAND_FIT_HEIGHT_PROPORTIONAL
  );
}

/**
 * `AspectRatioContainer::get_minimum_size` (`aspect_ratio_container.cpp:35-46`): the
 * componentwise max of each visible child's combined minimum size. `ratio`,
 * `stretch_mode` and alignment play no part in it.
 */
const aspectRatioContainerMinimumSize: MinimumSizeFn = (n, ctx) => {
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
 * `NOTIFICATION_SORT_CHILDREN` (`aspect_ratio_container.cpp:98-173`): each child is
 * `(ratio, 1.0)` scaled by the `stretch_mode` factor, floored to its combined minimum
 * (`:136-137`) and aligned (`:139-163`). `fit_child_in_rect` then applies the child's
 * own size flags, so a child without `SIZE_FILL` stays at its minimum.
 */
const aspectRatioContainerLayout: ContainerLayoutFn = (n, children, contentRect, _ctx) => {
  const p = props(n);
  const rtl = n.rtl;
  const ratio = p.ratio ?? 1.0;
  const stretchMode = p.stretchMode ?? AspectRatioStretchMode.STRETCH_FIT;
  const alignH = p.alignmentHorizontal ?? ContainerAlignment.ALIGNMENT_CENTER; // aspect_ratio_container.h:59
  const alignV = p.alignmentVertical ?? ContainerAlignment.ALIGNMENT_CENTER; // aspect_ratio_container.h:60

  const size = { x: contentRect.w, y: contentRect.h };
  const baseW = ratio;
  const baseH = 1.0;

  const out = new Map<string, Rect2>();
  // Every child gets its own rect in the same box, as `_notification` loops every child
  // (`aspect_ratio_container.cpp:98-173`), not only the first.
  for (const { node: child, minSize } of children) {
    if (!isSortableControl(child)) continue;
    // `WARN_PRINT_ONCE` and no rect (`:109-116`), which `dispatchChildren` floors to (0, 0, 0, 0).
    if (isUnsupportedTextureRect(child)) continue;

    let scaleFactor = 1.0;
    switch (stretchMode) {
      case AspectRatioStretchMode.STRETCH_WIDTH_CONTROLS_HEIGHT:
        scaleFactor = size.x / baseW;
        break;
      case AspectRatioStretchMode.STRETCH_HEIGHT_CONTROLS_WIDTH:
        scaleFactor = size.y / baseH;
        break;
      case AspectRatioStretchMode.STRETCH_FIT:
        scaleFactor = Math.min(size.x / baseW, size.y / baseH);
        break;
      case AspectRatioStretchMode.STRETCH_COVER:
        scaleFactor = Math.max(size.x / baseW, size.y / baseH);
        break;
      default:
        // No case matches an out-of-range value (:122-135 has no default
        // branch), so scale_factor keeps its initialized 1.0.
        break;
    }

    // All float (`Size2`, not `Size2i`): nothing truncates, unlike GridContainer.
    const childW = Math.max(baseW * scaleFactor, minSize.x);
    const childH = Math.max(baseH * scaleFactor, minSize.y);

    const alignX =
      alignH === ContainerAlignment.ALIGNMENT_BEGIN
        ? 0
        : alignH === ContainerAlignment.ALIGNMENT_END
          ? 1
          : 0.5;
    const alignY =
      alignV === ContainerAlignment.ALIGNMENT_BEGIN
        ? 0
        : alignV === ContainerAlignment.ALIGNMENT_END
          ? 1
          : 0.5;

    const offsetX = (size.x - childW) * alignX;
    const offsetY = (size.y - childH) * alignY;

    const cp = child.node.properties as AspectRatioContainerProperties;
    const hFlags = cp.sizeFlagsHorizontal ?? DEFAULT_SIZE_FLAGS;
    const vFlags = cp.sizeFlagsVertical ?? DEFAULT_SIZE_FLAGS;

    // `aspect_ratio_container.cpp:164-168`: the aligned x is measured from the
    // trailing edge, the whole container width away. The flag also reaches
    // `fit_child_in_rect`'s RTL arm (`container.cpp:99,105,109`).
    const x = rtl ? size.x - offsetX - childW : offsetX;

    out.set(
      child.path,
      fitChildInRect({ x, y: offsetY, w: childW, h: childH }, minSize, hFlags, vFlags, rtl)
    );
  }
  return out;
};

controlSolverRegistry.registerContainerLayout('AspectRatioContainer', aspectRatioContainerLayout);
