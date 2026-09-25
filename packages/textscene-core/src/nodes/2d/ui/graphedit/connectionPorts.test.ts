import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import type { GraphNodeProperties, GraphNodeSlot } from '../graphnode/types';
import '../graphnode/nativeSolver.js'; // registers GraphNode's MinimumSizeFn/ContainerLayoutFn
import { graphNodePorts } from './connectionPorts';

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

function graphNode(name: string, slots: Map<number, GraphNodeSlot>, children: SolveNode[]): SolveNode {
  return {
    ...solveNode(),
    path: name,
    node: {
      name,
      type: 'GraphNode',
      children: [],
      properties: { name, title: '', slots } as GraphNodeProperties,
    },
    children,
  };
}

describe('graphNodePorts (graph_node.cpp:1027-1059 _port_pos_update, via a re-solved subtree)', () => {
  it('places a single right port at (outerWidth, rowCenterY) — title \'\' floors the band to fontHeightPx(23)', () => {
    // panel margin round(18*1)/round(12*1) = 18/12, titlebar margin = contentMargin(4):
    // ofsY = 12 + (23 + 4 + 4) = 43; the one child (min height 20, drawStylebox: false)
    // solves to {x:18, y:43, w:84, h:20}, so slotY = 43 + 20/2 = 53.
    const node = graphNode('Source', new Map([[0, slot({ rightEnabled: true, rightColor: RED })]]), [
      leaf('Value', 20),
    ]);

    const ports = graphNodePorts(node, { x: 120, y: 80 }, nativeTheme(1), null);

    expect(ports).not.toBeNull();
    expect(ports!.outputs).toEqual([{ pos: { x: 120, y: 53 }, color: RED }]);
    expect(ports!.inputs).toEqual([]);
  });

  it('a left port sits at x = port_h_offset (theme_override_constants/port_h_offset)', () => {
    const node: SolveNode = {
      ...graphNode('Sink', new Map([[0, slot({ leftEnabled: true, leftColor: BLUE })]]), [leaf('Result', 20)]),
      constants: { port_h_offset: 6 },
    };

    const ports = graphNodePorts(node, { x: 120, y: 80 }, nativeTheme(1), null);

    expect(ports!.inputs).toEqual([{ pos: { x: 6, y: 53 }, color: BLUE }]);
    expect(ports!.outputs).toEqual([]);
  });

  it('compacts by rawIndex ascending — an earlier undeclared slot still occupies port index 0', () => {
    // Only rawIndex 1 declares a slot, but `_resort` also creates a default Slot() for
    // rawIndex 0, with both ports disabled. So the declared slot becomes
    // right_port_cache[0], not [1].
    const node = graphNode(
      'N',
      new Map([[1, slot({ rightEnabled: true, rightColor: RED })]]),
      [leaf('A', 20), leaf('B', 20)]
    );

    const ports = graphNodePorts(node, { x: 120, y: 100 }, nativeTheme(1), null);

    expect(ports!.outputs).toHaveLength(1);
    expect(ports!.outputs[0]!.color).toEqual(RED);
  });

  it('returns null for a non-GraphNode endpoint (GraphFrame has no ports, matching cast_to<GraphNode> failing)', () => {
    const node: SolveNode = { ...graphNode('Frame', new Map(), []), node: { ...graphNode('Frame', new Map(), []).node, type: 'GraphFrame' } };
    expect(graphNodePorts(node, { x: 100, y: 100 }, nativeTheme(1), null)).toBeNull();
  });
});
