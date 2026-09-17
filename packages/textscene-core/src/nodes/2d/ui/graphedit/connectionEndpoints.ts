/**
 * Resolves each `connections` entry to the two endpoint positions
 * `GraphEdit::_update_connections` draws a line between
 * (`scene/gui/graph_edit.cpp:1614-1660`):
 *
 *   from_pos = gnode_from.get_output_port_position(from_port) + gnode_from.position_offset
 *   line_points = get_connection_line(from_pos * zoom, to_pos * zoom)
 *
 * and `connections_layer->set_position(-scroll_offset)` (`:454`, translate
 * only — the layer itself is never scaled by `zoom`), so a point already
 * scaled by `zoom` reaches GraphEdit's own local space by subtracting
 * `scroll_offset` once more, unscaled.
 *
 * An endpoint that does not resolve to a real GraphNode (`Object::cast_to<
 * GraphNode>` failing, `graph_edit.cpp:1618,1623`) or whose port index is
 * out of range (`ERR_FAIL_INDEX_V`, `graph_node.cpp:1080-1123`) draws
 * nothing in Godot either way — `keep_alive` never changes that (this
 * module's own `types.ts` doc), so it is not modelled here.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { TextMeasurer } from '../../../../r3f/controls/native/solverRegistry.js';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree.js';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme.js';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect.js';
import type { ControlColor } from '../control/types.js';
import type { GraphElementProperties } from '../graphelement/types.js';
import { graphNodePorts } from './connectionPorts.js';
import type { GraphEditProperties } from './types.js';

export interface ResolvedConnectionEndpoint {
  /** GraphEdit's own local space — the same frame `rect` is drawn in. */
  pos: Vec2;
  /** `conn->_cache.<from|to>_pos * zoom` (`graph_edit.cpp:1872-1873`) — before any scroll subtraction, the frame the minimap measures against. */
  graphPos: Vec2;
  color: ControlColor;
}

export interface ResolvedConnection {
  from: ResolvedConnectionEndpoint;
  to: ResolvedConnectionEndpoint;
}

function endpoint(portLocal: Vec2, positionOffset: Vec2, zoom: number, scrollOffset: Vec2, color: ControlColor): ResolvedConnectionEndpoint {
  const graphPos = { x: (portLocal.x + positionOffset.x) * zoom, y: (portLocal.y + positionOffset.y) * zoom };
  return { pos: { x: graphPos.x - scrollOffset.x, y: graphPos.y - scrollOffset.y }, graphPos, color };
}

export function resolveGraphEditConnections(
  graphEdit: SolveNode,
  childRects: ReadonlyMap<string, Rect2>,
  props: GraphEditProperties,
  theme: NativeTheme,
  measureText: TextMeasurer | null
): ResolvedConnection[] {
  const zoom = props.zoom ?? 1;
  const scrollOffset = props.scrollOffset ?? { x: 0, y: 0 };
  const byName = new Map(graphEdit.children.map((c) => [c.node.name, c]));

  const resolved: ResolvedConnection[] = [];
  for (const conn of props.connections) {
    const fromChild = byName.get(conn.fromNode);
    const toChild = byName.get(conn.toNode);
    if (!fromChild || !toChild) continue;
    const fromRect = childRects.get(fromChild.path);
    const toRect = childRects.get(toChild.path);
    if (!fromRect || !toRect) continue;

    const fromPorts = graphNodePorts(fromChild, { x: fromRect.w, y: fromRect.h }, theme, measureText);
    const toPorts = graphNodePorts(toChild, { x: toRect.w, y: toRect.h }, theme, measureText);
    if (!fromPorts || !toPorts) continue;
    const outputPort = fromPorts.outputs[conn.fromPort];
    const inputPort = toPorts.inputs[conn.toPort];
    if (!outputPort || !inputPort) continue;

    const fromOffset = (fromChild.node.properties as GraphElementProperties).positionOffset ?? { x: 0, y: 0 };
    const toOffset = (toChild.node.properties as GraphElementProperties).positionOffset ?? { x: 0, y: 0 };

    resolved.push({
      from: endpoint(outputPort.pos, fromOffset, zoom, scrollOffset, outputPort.color),
      to: endpoint(inputPort.pos, toOffset, zoom, scrollOffset, inputPort.color),
    });
  }
  return resolved;
}
