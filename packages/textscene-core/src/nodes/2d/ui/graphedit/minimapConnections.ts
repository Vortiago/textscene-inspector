/**
 * The minimap's copy of every connection: `GraphEdit::_draw_minimap_connection_line`
 * (`scene/gui/graph_edit.cpp:1592-1612`), driven by `_minimap_draw`'s connection loop (`:1870-1883`).
 * It feeds `get_connection_line` positions shifted by `min_scroll_offset` (`:119`), not
 * `scroll_offset`, so the minimap shows the whole graph however far the view has scrolled.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { lerp } from '../../../../godot/math';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import type { ControlColor } from '../control/types';
import { connectionControlPoints, tessellateConnectionLine } from './connectionCurve';
import type { ResolvedConnection } from './connectionEndpoints';
import { minimapConvertFromGraph, type GraphScrollBounds, type MinimapTransform } from './minimap';

/** One `draw_polyline_colors` call: the mapped points and their per-point colours. */
export interface MinimapConnectionLine {
  points: Vec2[];
  colors: ControlColor[];
}

/** `Color::lerp`: component-wise, alpha included. */
function lerpColor(from: ControlColor, to: ControlColor, weight: number): ControlColor {
  return {
    r: lerp(from.r, to.r, weight),
    g: lerp(from.g, to.g, weight),
    b: lerp(from.b, to.b, weight),
    a: lerp(from.a, to.a, weight),
  };
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Maps each tessellated point through `_convert_from_graph_position` (`:135-143`) and the letterbox
 * origin. A point's colour lerps by its distance from the first point over the straight first-to-last
 * distance, after the mapping, so the minimap's aspect ratio changes the ramp. `activity` is runtime
 * only, so the activity lerp at `:1877-1880` is unreachable from a file.
 */
export function minimapConnectionLines(
  connections: readonly ResolvedConnection[],
  transform: MinimapTransform,
  bounds: GraphScrollBounds,
  curvature: number
): MinimapConnectionLine[] {
  return connections.map((connection) => {
    const from = { x: connection.from.graphPos.x - bounds.min.x, y: connection.from.graphPos.y - bounds.min.y };
    const to = { x: connection.to.graphPos.x - bounds.min.x, y: connection.to.graphPos.y - bounds.min.y };
    const points = tessellateConnectionLine(connectionControlPoints(from, to, curvature), curvature).map((point) => {
      const mapped = minimapConvertFromGraph(transform, point);
      return { x: mapped.x + transform.minimapOffset.x, y: mapped.y + transform.minimapOffset.y };
    });

    const lengthInv = 1 / distance(points[0]!, points[points.length - 1]!);
    const colors = points.map((point) =>
      lerpColor(connection.from.color, connection.to.color, distance(points[0]!, point) * lengthInv)
    );
    return { points, colors };
  });
}
