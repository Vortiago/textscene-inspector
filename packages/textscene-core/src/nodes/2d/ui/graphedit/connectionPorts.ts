/**
 * The port position of a connection endpoint, in the GraphNode's local space:
 * `GraphNode::_port_pos_update` (`scene/gui/graph_node.cpp:1007-1059`), fed by
 * `get_output_port_position` and `get_input_port_position` (`:1078-1123`).
 *
 * A sibling painter has no route to a child's `meta` (`ControlComponentRegistry.ts`), so this
 * runs the child's registered layout function again at its solved size. The ports then
 * match what the child's painter draws.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry.js';
import { combinedMinimumSize, createSolveContext } from '../../../../r3f/controls/native/controlRectSolver.js';
import type { TextMeasurer } from '../../../../r3f/controls/native/solverRegistry.js';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree.js';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme.js';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect.js';
import type { ControlColor } from '../control/types.js';
import { graphNodeDrawRows, graphNodeStyles } from '../graphnode/nativeSolver.js';
import type { GraphNodeProperties } from '../graphnode/types.js';

export interface GraphNodePort {
  pos: Vec2;
  color: ControlColor;
}

export interface GraphNodePorts {
  /** `right_port_cache`, compacted by ascending raw child index. `from_port` indexes it. */
  outputs: readonly GraphNodePort[];
  /** `left_port_cache`, compacted by ascending raw child index. `to_port` indexes it. */
  inputs: readonly GraphNodePort[];
}

/**
 * `null` when `child` is not a GraphNode: `_update_connections` casts each
 * endpoint with `Object::cast_to<GraphNode>` (`graph_edit.cpp:1618,1623`),
 * so a `GraphFrame` or bare `GraphElement` endpoint contributes no ports,
 * exactly like a missing node.
 */
export function graphNodePorts(
  child: SolveNode,
  outerSize: Vec2,
  theme: NativeTheme,
  measureText: TextMeasurer | null
): GraphNodePorts | null {
  if (child.node.type !== 'GraphNode') return null;
  const layoutFn = controlSolverRegistry.containerLayout('GraphNode');
  if (!layoutFn) return null;

  const ctx = createSolveContext(theme, measureText);
  const childEntries = child.children.map((c) => ({ node: c, minSize: combinedMinimumSize(c, ctx) }));
  const contentRect: Rect2 = { x: 0, y: 0, w: outerSize.x, h: outerSize.y };
  const result = layoutFn(child, childEntries, contentRect, ctx);
  const childRects = 'rects' in result ? result.rects : result;

  const props = child.node.properties as GraphNodeProperties;
  const { panel } = graphNodeStyles(child, theme);
  const bodyWidth = outerSize.x - panel.contentMargin.left - panel.contentMargin.right;
  const rows = [...graphNodeDrawRows(child, props, childRects, panel.contentMargin.left, bodyWidth)].sort(
    (a, b) => a.rawIndex - b.rawIndex
  );

  const portHOffset = child.constants.port_h_offset ?? 0;
  const outputs: GraphNodePort[] = [];
  const inputs: GraphNodePort[] = [];
  for (const row of rows) {
    if (row.slot.leftEnabled) {
      inputs.push({ pos: { x: portHOffset, y: row.slotY }, color: row.slot.leftColor });
    }
    if (row.slot.rightEnabled) {
      outputs.push({ pos: { x: outerSize.x - portHOffset, y: row.slotY }, color: row.slot.rightColor });
    }
  }
  return { outputs, inputs };
}
