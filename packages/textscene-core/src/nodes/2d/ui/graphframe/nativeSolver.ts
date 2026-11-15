/**
 * GraphFrame's native (WebGL canvas) rect solve: `GraphFrame::_resort` and `get_minimum_size`
 * (`scene/gui/graph_frame.cpp:145-169,324-346`), `Container::fit_child_in_rect` and the titlebar
 * band (`../graphelement/graphTitlebar.ts`). Unlike GraphNode, every child shares one content rect
 * (`:167`), with no stacking, separation or slots.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from '../../../../godot/math/rect2';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { graphElementStyles } from '../graphelement/graphElementStyles';
import {
  controlSolverRegistry,
  type ContainerLayoutFn,
  type MinimumSizeFn,
} from '../../../../r3f/controls/native/solverRegistry';
import { fitChildInRect, isSortableControl } from '../shared/fitChildInRect';
import { registerInternalControls } from '../../../../r3f/controls/native/internalControls';
import {
  GRAPH_FRAME_TITLE_LABEL,
  titlebarBandHeightChannel,
  titlebarInternalControls,
  titlebarInternalLayout,
  titlebarMinimumSize,
  titlebarHeights,
} from '../graphelement/graphTitlebar';
import type { GraphFrameProperties } from './types';
import { DEFAULT_SIZE_FLAGS } from '../../../../godot/scene/control';

function hFlagsOf(n: SolveNode): number {
  return (n.node.properties as GraphFrameProperties).sizeFlagsHorizontal ?? DEFAULT_SIZE_FLAGS;
}
function vFlagsOf(n: SolveNode): number {
  return (n.node.properties as GraphFrameProperties).sizeFlagsVertical ?? DEFAULT_SIZE_FLAGS;
}

// --- get_minimum_size ---------------------------------------------------------

const graphFrameMinimumSize: MinimumSizeFn = (n, ctx) => {
  const { panel } = graphElementStyles(n);
  let { x: width, y: height } = titlebarMinimumSize(n, ctx);

  for (const child of n.children) {
    if (!isSortableControl(child)) continue;
    const cms = ctx.combinedMinimumSize(child);
    const w = cms.x + panel.contentMargin.left + panel.contentMargin.right;
    width = Math.max(width, w);
    // graph_frame.cpp:340: `minsize.y += MAX(minsize.y, size.y)`, not `=`, so each child at least
    // doubles the running height. The port keeps it: the engine source is the spec.
    height += Math.max(height, cms.y);
  }

  height += panel.contentMargin.top + panel.contentMargin.bottom;
  return { x: width, y: height };
};

controlSolverRegistry.registerMinimumSize('GraphFrame', graphFrameMinimumSize);
registerInternalControls(
  'GraphFrame',
  titlebarInternalControls(GRAPH_FRAME_TITLE_LABEL),
  titlebarInternalLayout
);

// --- _resort -------------------------------------------------------------------

const graphFrameLayout: ContainerLayoutFn = (n, children, contentRect, ctx) => {
  const { panel } = graphElementStyles(n);
  const band = titlebarHeights(n, ctx);

  const offset = { x: panel.contentMargin.left, y: panel.contentMargin.top + band.resort };
  const size = {
    w: Math.max(0, contentRect.w - panel.contentMargin.left - panel.contentMargin.right),
    h: Math.max(0, contentRect.h - panel.contentMargin.top - panel.contentMargin.bottom - band.resort),
  };
  const rawRect: Rect2 = { x: offset.x, y: offset.y, w: size.w, h: size.h };

  const rects = new Map<string, Rect2>();
  for (const { node: child, minSize } of children) {
    if (!isSortableControl(child)) continue;
    // `graph_frame.cpp` has no RTL branch; `fit_child_in_rect` reads the flag itself.
    rects.set(child.path, fitChildInRect(rawRect, minSize, hFlagsOf(child), vFlagsOf(child), n.rtl));
  }
  return { rects, meta: titlebarBandHeightChannel.seal(band.drawn) };
};

controlSolverRegistry.registerContainerLayout('GraphFrame', graphFrameLayout);
