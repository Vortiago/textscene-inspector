import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import type { GraphNodeProperties, GraphNodeSlot } from '../graphnode/types';
import '../graphnode/nativeSolver.js';
import type { GraphEditConnection, GraphEditProperties } from './types';
import { resolveGraphEditConnections } from './connectionEndpoints';

const RED = { r: 1, g: 0, b: 0, a: 1 };
const BLUE = { r: 0, g: 0, b: 1, a: 1 };

function slot(overrides: Partial<GraphNodeSlot>): GraphNodeSlot {
  return {
    leftEnabled: false,
    leftType: 0,
    leftColor: { r: 1, g: 1, b: 1, a: 1 },
    rightEnabled: false,
    rightType: 0,
    rightColor: { r: 1, g: 1, b: 1, a: 1 },
    drawStylebox: false,
    ...overrides,
  };
}

function leaf(name: string, minHeight: number): SolveNode {
  return {
    ...solveNode(),
    path: name,
    node: {
      name,
      type: 'Control',
      children: [],
      properties: { name, customMinimumSize: { x: 0, y: minHeight } } as ControlProperties,
    },
  };
}

function graphNode(
  name: string,
  positionOffset: { x: number; y: number },
  slots: Map<number, GraphNodeSlot>,
  children: SolveNode[]
): SolveNode {
  return {
    ...solveNode(),
    path: name,
    node: {
      name,
      type: 'GraphNode',
      children: [],
      properties: { name, title: '', positionOffset, slots } as GraphNodeProperties,
    },
    children,
  };
}

describe('resolveGraphEditConnections (graph_edit.cpp:1614-1660 _update_connections)', () => {
  it('endpoint = (portLocal + position_offset) * zoom - scroll_offset, for a known slot/position_offset/zoom/scroll_offset', () => {
    const source = graphNode('Source', { x: 40, y: 56 }, new Map([[0, slot({ rightEnabled: true, rightColor: RED })]]), [
      leaf('Value', 20),
    ]);
    const sink = graphNode('Sink', { x: 220, y: 56 }, new Map([[0, slot({ leftEnabled: true, leftColor: BLUE })]]), [
      leaf('Result', 20),
    ]);
    const graphEdit: SolveNode = { ...solveNode(), path: 'G', node: { name: 'G', type: 'GraphEdit', children: [], properties: { name: 'G' } as ControlProperties }, children: [source, sink] };

    const childRects: ReadonlyMap<string, Rect2> = new Map([
      ['Source', { x: 40 * 1.5 - 32, y: 56 * 1.5 - 16, w: 120, h: 80 }],
      ['Sink', { x: 220 * 1.5 - 32, y: 56 * 1.5 - 16, w: 120, h: 80 }],
    ]);

    const props = {
      zoom: 1.5,
      scrollOffset: { x: 32, y: 16 },
      connections: [{ fromNode: 'Source', fromPort: 0, toNode: 'Sink', toPort: 0 }] as GraphEditConnection[],
    } as GraphEditProperties;

    const resolved = resolveGraphEditConnections(graphEdit, childRects, props, nativeTheme(1), null);

    expect(resolved).toHaveLength(1);
    // port local (120, 53) — `connectionPorts.test.ts`'s own hand-derived row.
    // (120 + 40) * 1.5 = 240 in graph space, less scroll_offset 32 = 208;
    // (53 + 56) * 1.5 = 163.5, less 16 = 147.5.
    expect(resolved[0]!.from).toEqual({ pos: { x: 208, y: 147.5 }, graphPos: { x: 240, y: 163.5 }, color: RED });
    // port local (0, 53); (0 + 220) * 1.5 = 330, less 32 = 298.
    expect(resolved[0]!.to).toEqual({ pos: { x: 298, y: 147.5 }, graphPos: { x: 330, y: 163.5 }, color: BLUE });
  });

  it('drops a connection whose endpoint node does not resolve (get_node_or_null returning null, no keep_alive path draws)', () => {
    const source = graphNode('Source', { x: 0, y: 0 }, new Map([[0, slot({ rightEnabled: true, rightColor: RED })]]), [
      leaf('Value', 20),
    ]);
    const graphEdit: SolveNode = { ...solveNode(), path: 'G', node: { name: 'G', type: 'GraphEdit', children: [], properties: { name: 'G' } as ControlProperties }, children: [source] };
    const childRects: ReadonlyMap<string, Rect2> = new Map([['Source', { x: 0, y: 0, w: 120, h: 80 }]]);
    const props = {
      connections: [{ fromNode: 'Source', fromPort: 0, toNode: 'Missing', toPort: 0 }] as GraphEditConnection[],
    } as GraphEditProperties;

    expect(resolveGraphEditConnections(graphEdit, childRects, props, nativeTheme(1), null)).toEqual([]);
  });

  it('drops a connection whose port index is out of range (ERR_FAIL_INDEX_V returning a null Vector2 draws nothing usable)', () => {
    const source = graphNode('Source', { x: 0, y: 0 }, new Map([[0, slot({ rightEnabled: true, rightColor: RED })]]), [
      leaf('Value', 20),
    ]);
    const sink = graphNode('Sink', { x: 100, y: 0 }, new Map([[0, slot({ leftEnabled: true, leftColor: BLUE })]]), [
      leaf('Result', 20),
    ]);
    const graphEdit: SolveNode = { ...solveNode(), path: 'G', node: { name: 'G', type: 'GraphEdit', children: [], properties: { name: 'G' } as ControlProperties }, children: [source, sink] };
    const childRects: ReadonlyMap<string, Rect2> = new Map([
      ['Source', { x: 0, y: 0, w: 120, h: 80 }],
      ['Sink', { x: 100, y: 0, w: 120, h: 80 }],
    ]);
    const props = {
      connections: [{ fromNode: 'Source', fromPort: 3, toNode: 'Sink', toPort: 0 }] as GraphEditConnection[],
    } as GraphEditProperties;

    expect(resolveGraphEditConnections(graphEdit, childRects, props, nativeTheme(1), null)).toEqual([]);
  });
});
