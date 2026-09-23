/**
 * GraphFrame's native (WebGL canvas) rect solve: `GraphFrame::_resort`,
 * `GraphFrame::get_minimum_size` (`scene/gui/graph_frame.cpp:145-169,324-346`),
 * `scene/gui/container.cpp` (`Container::fit_child_in_rect`) and this node's
 * own titlebar band (`../graphelement/graphTitlebar.ts`).
 *
 * Unlike GraphNode, every child shares one content rect (`_resort` feeds one
 * `Rect2(offset, size)` to each `fit_child_in_rect` call, `:167`), with no
 * stacking, separation or slots.
 *
 * `get_minimum_size` folds height as `minsize.y += MAX(minsize.y, size.y)`
 * (`:340`), not `=`, so each child at least doubles the running height. The
 * port keeps it: the engine source is the spec.
 *
 * Pure data + functions, no React, no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { ControlColor } from '../control/types';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { DEFAULT_CONTENT_MARGIN } from '../../../../r3f/controls/godotDefaultTheme';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import {
  controlSolverRegistry,
  type ContainerLayoutFn,
  type MinimumSizeFn,
} from '../../../../r3f/controls/native/solverRegistry';
import { fitChildInRect, isSortableControl, SIZE_FILL } from '../shared/fitChildInRect';
import { resolveTitleFontTheme, titleTextMinimumSize, titlebarGeometry } from '../graphelement/graphTitlebar';
import type { GraphFrameProperties } from './types';

const DEFAULT_SIZE_FLAGS = SIZE_FILL;

/** `graph_frame.cpp` theme type variation for its internal title Label: `graph_frame.cpp:354`. */
export const GRAPH_FRAME_TITLE_VARIATION = 'GraphFrameTitleLabel';

/** `default_theme.cpp:849`: `GraphFrameTitleLabel`'s own `font_color`, opaque white. */
export const GRAPH_FRAME_TITLE_DEFAULT_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 1 };

/**
 * `default_theme.cpp:848`: `theme->set_font_size(font_size, "GraphFrameTitleLabel", 22)`,
 * a literal `22` where the function scales each other constant, so it stays unscaled.
 */
export const GRAPH_FRAME_TITLE_FONT_SIZE_PX = 22;

/** `control_font_color`: `default_theme.cpp:841`, `GraphFrame`'s own `resizer_color`. */
export const GRAPH_FRAME_RESIZER_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 1 };

function flatBox(
  bgColor: ControlColor,
  borderColor: ControlColor,
  borderWidth: number,
  margin: { left: number; top: number; right: number; bottom: number },
  expandTop: number,
  cornerRadius: number
): StyleBoxFlatData {
  return {
    bgColor,
    borderColor,
    borderWidth: { left: borderWidth, top: borderWidth, right: borderWidth, bottom: borderWidth },
    cornerRadius: { topLeft: cornerRadius, topRight: cornerRadius, bottomRight: cornerRadius, bottomLeft: cornerRadius },
    expandMargin: { left: 0, top: expandTop, right: 0, bottom: 0 },
    contentMargin: margin,
    drawCenter: true,
    borderBlend: false,
    antiAliased: true,
    aaSize: 1,
    cornerDetail: 8,
    skew: { x: 0, y: 0 },
    shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
    shadowSize: 0,
    shadowOffset: { x: 0, y: 0 },
  };
}

/**
 * GraphFrame's default-theme StyleBoxes: `default_theme.cpp:828-841`. Not in
 * `nativeTheme.ts`'s `widgets` (no entry for GraphFrame there).
 */
function defaultStyles(theme: NativeTheme) {
  // `make_flat_stylebox(style_pressed_color, 18, 12, 18, 12, 3, true, 2)`:
  // margins its own literals (18, 12), corner radius the shared default (3),
  // border_width 2 (all scaled). Scale recovered the same way GraphNode's
  // own `defaultStyles` does: see that module's doc.
  const scale = theme.contentMargin / DEFAULT_CONTENT_MARGIN;
  const panelMargin = {
    left: Math.round(18 * scale),
    top: Math.round(12 * scale),
    right: Math.round(18 * scale),
    bottom: Math.round(12 * scale),
  };
  const borderWidth = Math.round(2 * scale);
  const expandTop = Math.round(38 * scale);
  const panel = flatBox(theme.styleFill.pressed, theme.styleFill.pressed, borderWidth, panelMargin, expandTop, theme.cornerRadius);
  const panelSelected = flatBox(theme.styleFill.pressed, theme.styleFill.hover, borderWidth, panelMargin, expandTop, theme.cornerRadius);
  // `make_empty_stylebox(4, 4, 4, 4)`: draws nothing, margin `default_margin`.
  const titlebarMargin = {
    left: theme.contentMargin,
    top: theme.contentMargin,
    right: theme.contentMargin,
    bottom: theme.contentMargin,
  };
  const titlebar = flatBox({ r: 0, g: 0, b: 0, a: 0 }, { r: 0, g: 0, b: 0, a: 0 }, 0, titlebarMargin, 0, 0);
  return { panel, panelSelected, titlebar, titlebarSelected: titlebar };
}

export function graphFrameStyles(n: SolveNode, theme: NativeTheme) {
  const d = defaultStyles(theme);
  return {
    panel: n.styleBoxes.panel ?? d.panel,
    panelSelected: n.styleBoxes.panel_selected ?? d.panelSelected,
    titlebar: n.styleBoxes.titlebar ?? d.titlebar,
    titlebarSelected: n.styleBoxes.titlebar_selected ?? d.titlebarSelected,
  };
}

function hFlagsOf(n: SolveNode): number {
  return (n.node.properties as GraphFrameProperties).sizeFlagsHorizontal ?? DEFAULT_SIZE_FLAGS;
}
function vFlagsOf(n: SolveNode): number {
  return (n.node.properties as GraphFrameProperties).sizeFlagsVertical ?? DEFAULT_SIZE_FLAGS;
}

export function graphFrameTitleTextMin(n: SolveNode, _theme: NativeTheme): Vec2 {
  const props = n.node.properties as GraphFrameProperties;
  const fontTheme = resolveTitleFontTheme(
    n,
    GRAPH_FRAME_TITLE_VARIATION,
    GRAPH_FRAME_TITLE_FONT_SIZE_PX,
    GRAPH_FRAME_TITLE_DEFAULT_COLOR
  );
  return titleTextMinimumSize(props.title ?? '', fontTheme);
}

// --- get_minimum_size ---------------------------------------------------------

export const graphFrameMinimumSize: MinimumSizeFn = (n, ctx) => {
  const { panel, titlebar } = graphFrameStyles(n, ctx.theme);
  const textMin = graphFrameTitleTextMin(n, ctx.theme);

  let width = textMin.x + titlebar.contentMargin.left + titlebar.contentMargin.right;
  let height = textMin.y + titlebar.contentMargin.top + titlebar.contentMargin.bottom;

  for (const child of n.children) {
    if (!isSortableControl(child)) continue;
    const cms = ctx.combinedMinimumSize(child);
    const w = cms.x + panel.contentMargin.left + panel.contentMargin.right;
    width = Math.max(width, w);
    // graph_frame.cpp:340: `minsize.y += MAX(minsize.y, size.y)`, literal.
    height += Math.max(height, cms.y);
  }

  height += panel.contentMargin.top + panel.contentMargin.bottom;
  return { x: width, y: height };
};

controlSolverRegistry.registerMinimumSize('GraphFrame', graphFrameMinimumSize);

// --- _resort -------------------------------------------------------------------

export const graphFrameLayout: ContainerLayoutFn = (n, children, contentRect, ctx) => {
  const { panel, titlebar } = graphFrameStyles(n, ctx.theme);
  const textMin = graphFrameTitleTextMin(n, ctx.theme);
  const titlebarBand = titlebarGeometry(contentRect.w, textMin.y, titlebar);

  const offset = { x: panel.contentMargin.left, y: panel.contentMargin.top + titlebarBand.rect.h };
  const size = {
    w: Math.max(0, contentRect.w - panel.contentMargin.left - panel.contentMargin.right),
    h: Math.max(0, contentRect.h - panel.contentMargin.top - panel.contentMargin.bottom - titlebarBand.rect.h),
  };
  const rawRect: Rect2 = { x: offset.x, y: offset.y, w: size.w, h: size.h };

  const rects = new Map<string, Rect2>();
  for (const { node: child, minSize } of children) {
    if (!isSortableControl(child)) continue;
    // `graph_frame.cpp` has no RTL branch; `fit_child_in_rect` reads the flag itself.
    rects.set(child.path, fitChildInRect(rawRect, minSize, hFlagsOf(child), vFlagsOf(child), n.rtl));
  }
  return rects;
};

controlSolverRegistry.registerContainerLayout('GraphFrame', graphFrameLayout);
