/**
 * `GraphEditMinimap`'s geometry — the bottom-right overview panel GraphEdit's
 * own CONSTRUCTOR builds (`scene/gui/graph_edit.cpp:3325-3340`), so every
 * GraphEdit carries one whatever the scene file says.
 *
 * Three pieces of Godot arithmetic meet here:
 *
 *  - `GraphEdit::set_minimap_size` (`:2770-2780`) — the panel's own rect:
 *    `PRESET_BOTTOM_RIGHT` plus four offsets built from the size AFTER
 *    `Control::set_size`'s floor against `custom_minimum_size` (`:3332`).
 *  - `GraphEdit::_update_scrollbars` (`:472-493`) — `min_scroll_offset`/
 *    `max_scroll_offset`, the graph bounding box every conversion below is
 *    expressed against. It merges into a DEFAULT `Rect2`, so the graph origin
 *    is always inside the box (`core/math/rect2.h:165-180`).
 *  - `GraphEditMinimap::update_minimap` (`:76-101`) and its two converters
 *    (`:135-158`) — the letterboxed graph-to-minimap mapping.
 *
 * Pure data + functions, no React, no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { sortableView } from '../../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { ControlColor, ControlProperties } from '../control/types';
import type { GraphElementProperties } from '../graphelement/types';
import type { GraphFrameProperties } from '../graphframe/types';
import { graphNodeStyles } from '../graphnode/nativeSolver';
import { graphFrameStyles } from '../graphframe/nativeSolver';
import type { GraphEditProperties } from './types';

/** `MINIMAP_OFFSET` (`graph_edit.cpp:51`) — unscaled, like every other constant in that block. */
export const GRAPH_EDIT_MINIMAP_OFFSET = 12;
/** `MINIMAP_PADDING` (`graph_edit.cpp:52`). */
export const GRAPH_EDIT_MINIMAP_PADDING = 5;
/** The minimap's own `custom_minimum_size` (`graph_edit.cpp:3332`). */
export const GRAPH_EDIT_MINIMAP_MIN_SIZE = 50;
/** `const Vector2 minimap_size = Vector2(240, 160)` (`graph_edit.cpp:3326`). */
export const GRAPH_EDIT_MINIMAP_DEFAULT_SIZE: Vec2 = { x: 240, y: 160 };
/** `const float minimap_opacity = 0.65` (`graph_edit.cpp:3327`). */
export const GRAPH_EDIT_MINIMAP_DEFAULT_OPACITY = 0.65;

/**
 * `GraphEdit::is_minimap_enabled` (`:2808-2810`) — `minimap_button->is_pressed()`.
 * The constructor presses it from the MEMBER `show_grid` (`:3311`), which runs
 * before any scene property, so the default is on whatever the file's own
 * `show_grid` says; only `minimap_enabled` moves it (`:2799-2806`).
 */
export function isMinimapEnabled(props: GraphEditProperties): boolean {
  return props.minimapEnabled ?? true;
}

/** `GraphEdit::get_minimap_opacity` (`:2792-2795`) — the minimap's `modulate.a`; `set_minimap_opacity` clamps nothing. */
export function minimapOpacity(props: GraphEditProperties): number {
  return props.minimapOpacity ?? GRAPH_EDIT_MINIMAP_DEFAULT_OPACITY;
}

/** `GraphEdit::set_minimap_size` (`:2770-2780`), the rect its four offsets resolve to inside GraphEdit's own. */
export function minimapRect(graphEditSize: Vec2, props: GraphEditProperties): Rect2 {
  const requested = props.minimapSize ?? GRAPH_EDIT_MINIMAP_DEFAULT_SIZE;
  // `minimap->get_size()` after `Control::set_size`'s own floor (`control.cpp:1496-1503`).
  const w = Math.max(requested.x, GRAPH_EDIT_MINIMAP_MIN_SIZE);
  const h = Math.max(requested.y, GRAPH_EDIT_MINIMAP_MIN_SIZE);
  return {
    x: graphEditSize.x - w - GRAPH_EDIT_MINIMAP_OFFSET,
    y: graphEditSize.y - h - GRAPH_EDIT_MINIMAP_OFFSET,
    w,
    h,
  };
}

/** One GraphElement child as `_update_scrollbars`/`_minimap_draw` read it: its own `position_offset` and unscaled size. */
export interface GraphElementBox {
  positionOffset: Vec2;
  size: Vec2;
}

/** `min_scroll_offset`/`max_scroll_offset` (`graph_edit.cpp:492-493`). */
export interface GraphScrollBounds {
  min: Vec2;
  max: Vec2;
}

/**
 * `GraphEdit::_update_scrollbars`' own screen-space bounding box
 * (`:472-493`). No visibility test: a hidden GraphElement still widens it,
 * unlike `_minimap_draw`'s own loops (`:1821,1844`).
 */
export function graphScrollBounds(
  elements: readonly GraphElementBox[],
  zoom: number,
  graphEditSize: Vec2
): GraphScrollBounds {
  let left = 0;
  let top = 0;
  let right = 0;
  let bottom = 0;
  for (const e of elements) {
    const x = e.positionOffset.x * zoom;
    const y = e.positionOffset.y * zoom;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + e.size.x * zoom);
    bottom = Math.max(bottom, y + e.size.y * zoom);
  }
  return {
    min: { x: left - graphEditSize.x, y: top - graphEditSize.y },
    max: { x: right + graphEditSize.x, y: bottom + graphEditSize.y },
  };
}

/** The state `update_minimap` (`:76-101`) leaves behind, as the converters read it. */
export interface MinimapTransform {
  /** `_get_render_size` (`:112-118`) — the minimap rect less both paddings. */
  renderSize: Vec2;
  /** `graph_proportions` — the graph box letterboxed to the minimap's aspect. */
  graphProportions: Vec2;
  /** `minimap_offset` — where the letterboxed graph starts inside the minimap. */
  minimapOffset: Vec2;
}

/** `GraphEditMinimap::_get_graph_size` (`:121-132`) — a zero extent is floored at 1 so the ratios stay finite. */
function graphSize(bounds: GraphScrollBounds): Vec2 {
  const x = bounds.max.x - bounds.min.x;
  const y = bounds.max.y - bounds.min.y;
  return { x: x === 0 ? 1 : x, y: y === 0 ? 1 : y };
}

/** `GraphEditMinimap::update_minimap` (`:76-101`), the parts a static frame reads. */
export function minimapTransform(minimapSize: Vec2, bounds: GraphScrollBounds): MinimapTransform {
  const renderSize = {
    x: minimapSize.x - 2 * GRAPH_EDIT_MINIMAP_PADDING,
    y: minimapSize.y - 2 * GRAPH_EDIT_MINIMAP_PADDING,
  };
  const graph = graphSize(bounds);
  const targetRatio = renderSize.x / renderSize.y;
  const graphRatio = graph.x / graph.y;

  const graphProportions = { x: graph.x, y: graph.y };
  const graphPadding = { x: 0, y: 0 };
  if (graphRatio > targetRatio) {
    graphProportions.y = graph.x / targetRatio;
    graphPadding.y = Math.abs(graph.y - graphProportions.y) / 2;
  } else {
    graphProportions.x = graph.y * targetRatio;
    graphPadding.x = Math.abs(graph.x - graphProportions.x) / 2;
  }

  const partial: MinimapTransform = { renderSize, graphProportions, minimapOffset: { x: 0, y: 0 } };
  const centring = minimapConvertFromGraph(partial, graphPadding);
  return {
    renderSize,
    graphProportions,
    minimapOffset: {
      x: GRAPH_EDIT_MINIMAP_PADDING + centring.x,
      y: GRAPH_EDIT_MINIMAP_PADDING + centring.y,
    },
  };
}

/** `GraphEditMinimap::_convert_from_graph_position` (`:135-143`). */
export function minimapConvertFromGraph(t: MinimapTransform, p: Vec2): Vec2 {
  return {
    x: (p.x * t.renderSize.x) / t.graphProportions.x,
    y: (p.y * t.renderSize.y) / t.graphProportions.y,
  };
}

/** One GraphFrame/GraphNode rect inside the minimap — `_minimap_draw` (`:1827-1829,1850-1852`). */
export function minimapNodeRect(
  t: MinimapTransform,
  bounds: GraphScrollBounds,
  element: GraphElementBox,
  zoom: number
): Rect2 {
  const position = minimapConvertFromGraph(t, {
    x: element.positionOffset.x * zoom - bounds.min.x,
    y: element.positionOffset.y * zoom - bounds.min.y,
  });
  const size = minimapConvertFromGraph(t, { x: element.size.x * zoom, y: element.size.y * zoom });
  return {
    x: position.x + t.minimapOffset.x,
    y: position.y + t.minimapOffset.y,
    w: size.x,
    h: size.y,
  };
}

/** `GraphEditMinimap::get_camera_rect` (`:104-109`), with `camera_position`/`camera_size` from `update_minimap` (`:81-82`). */
export function minimapCameraRect(
  t: MinimapTransform,
  bounds: GraphScrollBounds,
  scrollOffset: Vec2,
  graphEditSize: Vec2
): Rect2 {
  const cameraPosition = { x: scrollOffset.x - bounds.min.x, y: scrollOffset.y - bounds.min.y };
  const centre = minimapConvertFromGraph(t, {
    x: cameraPosition.x + graphEditSize.x / 2,
    y: cameraPosition.y + graphEditSize.y / 2,
  });
  const viewport = minimapConvertFromGraph(t, graphEditSize);
  return {
    x: centre.x + t.minimapOffset.x - viewport.x / 2,
    y: centre.y + t.minimapOffset.y - viewport.y / 2,
    w: viewport.x,
    h: viewport.y,
  };
}

/** One GraphFrame/GraphNode as `_minimap_draw` reads it (`:1821-1866`): its box, plus the bg colour its own `panel` stylebox carries. */
export interface MinimapElement extends GraphElementBox {
  key: string;
  bgColor: ControlColor;
}

/** `GraphFrame::tint_color`'s own default (`graph_frame.h:61`). */
const GRAPH_FRAME_DEFAULT_TINT: ControlColor = { r: 0.3, g: 0.3, b: 0.3, a: 0.75 };

export interface GraphEditElementView {
  bounds: GraphScrollBounds;
  /** Frames first, then nodes, each from the LAST child backwards — `_minimap_draw`'s own two loops (`:1821,1844`), so a frame never covers a node. */
  minimapElements: MinimapElement[];
}

/**
 * The one walk over GraphEdit's GraphElement children both the scroll bounds
 * and the minimap need. `_update_scrollbars` (`:472-493`) counts every one of
 * them, hidden included; `_minimap_draw` (`:1821,1844`) then skips the hidden
 * ones — so the two lists differ and are built together rather than twice.
 *
 * Both cast `get_child(i)`, which is why the walk runs over `sortableView`:
 * a Control promoted past a Node2D is neither bounded nor drawn.
 */
export function graphEditElements(
  graphEdit: SolveNode,
  childRects: ReadonlyMap<string, Rect2>,
  zoom: number,
  graphEditSize: Vec2,
  theme: NativeTheme
): GraphEditElementView {
  const boxes: { key: string; box: GraphElementBox; type: string; visible: boolean; node: SolveNode }[] = [];
  for (const child of sortableView(graphEdit).children) {
    if (child.node.type !== 'GraphNode' && child.node.type !== 'GraphFrame' && child.node.type !== 'GraphElement') continue;
    const childRect = childRects.get(child.path);
    if (!childRect) continue;
    boxes.push({
      key: child.path,
      box: {
        positionOffset: (child.node.properties as GraphElementProperties).positionOffset ?? { x: 0, y: 0 },
        size: { x: childRect.w, y: childRect.h },
      },
      type: child.node.type,
      visible: (child.node.properties as ControlProperties).visible !== false,
      node: child,
    });
  }

  const minimapElements: MinimapElement[] = [];
  for (const wanted of ['GraphFrame', 'GraphNode'] as const) {
    for (let i = boxes.length - 1; i >= 0; i--) {
      const e = boxes[i]!;
      if (e.type !== wanted || !e.visible) continue;
      // `sb_frame->get_bg_color()`, or the frame's own tint where it is enabled (`:1834-1840`).
      const frameProps = e.node.node.properties as GraphFrameProperties;
      const bgColor =
        wanted === 'GraphFrame'
          ? frameProps.tintColorEnabled
            ? (frameProps.tintColor ?? GRAPH_FRAME_DEFAULT_TINT)
            : graphFrameStyles(e.node, theme).panel.bgColor
          : graphNodeStyles(e.node, theme).panel.bgColor;
      minimapElements.push({ key: e.key, ...e.box, bgColor });
    }
  }

  return { bounds: graphScrollBounds(boxes.map((e) => e.box), zoom, graphEditSize), minimapElements };
}
