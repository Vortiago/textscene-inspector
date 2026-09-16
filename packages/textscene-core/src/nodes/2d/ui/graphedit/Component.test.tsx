/**
 * `<GraphEdit>` render contract — background panel + grid. Structure/tint
 * assertions only (pixels are a golden-image concern via `pnpm ref:godot`,
 * not this suite).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { ControlProperties } from '../control/types';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import type { GraphNodeProperties, GraphNodeSlot } from '../graphnode/types';
import '../graphnode/nativeSolver.js'; // registers GraphNode's MinimumSizeFn/ContainerLayoutFn
import { GraphEdit } from './Component';
import type { GraphEditConnection, GraphEditProperties } from './types';

const RECT: Rect2 = { x: 0, y: 0, w: 100, h: 100 };

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function graphEdit(properties: Partial<GraphEditProperties> = {}, children: SolveNode[] = []): SolveNode {
  const node: TscnNode = {
    name: 'G',
    type: 'GraphEdit',
    children: [],
    properties: { name: 'G', connections: [], ...properties } as GraphEditProperties,
  };
  return { ...emptySolveNode(), path: 'G', node, children };
}

function fullSlot(overrides: Partial<GraphNodeSlot>): GraphNodeSlot {
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

function leafControl(name: string, minHeight: number): SolveNode {
  return {
    ...emptySolveNode(),
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
    ...emptySolveNode(),
    path: name,
    node: {
      name,
      type: 'GraphNode',
      children: [],
      properties: { name, title: '', positionOffset: { x: 0, y: 0 }, slots } as GraphNodeProperties,
    },
    children,
  };
}

function chromeMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

/** Every mesh a `<ControlQuad>` (line/dot) draws — no `color` attribute, unlike a `StyleBoxQuad`. */
function quadMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as THREE.BufferGeometry).attributes.color === undefined);
}

describe('<GraphEdit> (isolated painter contract)', () => {
  it('draws one chrome mesh — the background panel', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphEdit {...painterEnv()} solveNode={graphEdit({ showGrid: false })} rect={RECT} renderOrder={0} />
    );
    expect(chromeMeshes(renderer.scene)).toHaveLength(1);
  });

  it('draws grid line quads at the default LINES pattern (show_grid defaults true)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphEdit {...painterEnv()} solveNode={graphEdit()} rect={RECT} renderOrder={0} />
    );
    // snapping_distance defaults 20 over a 100px rect: 6 vertical + 6 horizontal lines.
    expect(quadMeshes(renderer.scene)).toHaveLength(12);
  });

  it('draws no grid quads when show_grid is false', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphEdit {...painterEnv()} solveNode={graphEdit({ showGrid: false })} rect={RECT} renderOrder={0} />
    );
    expect(quadMeshes(renderer.scene)).toHaveLength(0);
  });

  it('draws dot quads (not lines) at the DOTS pattern', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphEdit {...painterEnv()} solveNode={graphEdit({ gridPattern: 1 })} rect={RECT} renderOrder={0} />
    );
    // 6x6=36 cells; i,j in {0,5} (4 pairs) are major-only, so 32 minor + 4 major = 36 dots.
    expect(quadMeshes(renderer.scene)).toHaveLength(36);
  });
});

describe('<GraphEdit> connections (graph_edit.cpp:1614-1660 _update_connections)', () => {
  const source = graphNode('Source', new Map([[0, fullSlot({ rightEnabled: true })]]), [leafControl('Value', 20)]);
  const sink = graphNode('Sink', new Map([[0, fullSlot({ leftEnabled: true })]]), [leafControl('Result', 20)]);
  const childRects: ReadonlyMap<string, Rect2> = new Map([
    ['Source', { x: 0, y: 0, w: 120, h: 80 }],
    ['Sink', { x: 200, y: 0, w: 120, h: 80 }],
  ]);
  const connections: GraphEditConnection[] = [{ fromNode: 'Source', fromPort: 0, toNode: 'Sink', toPort: 0 }];

  it('draws one extra vertex-coloured mesh (panel + one connection ribbon) for a resolvable connection', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphEdit
        {...painterEnv()}
        childRects={childRects}
        solveNode={graphEdit({ showGrid: false, connections }, [source, sink])}
        rect={{ x: 0, y: 0, w: 400, h: 100 }}
        renderOrder={0}
      />
    );
    expect(chromeMeshes(renderer.scene)).toHaveLength(2);
  });

  it('draws nothing extra when an endpoint node is missing', async () => {
    const dangling: GraphEditConnection[] = [{ fromNode: 'Source', fromPort: 0, toNode: 'Nowhere', toPort: 0 }];
    const renderer = await ReactThreeTestRenderer.create(
      <GraphEdit
        {...painterEnv()}
        childRects={childRects}
        solveNode={graphEdit({ showGrid: false, connections: dangling }, [source, sink])}
        rect={{ x: 0, y: 0, w: 400, h: 100 }}
        renderOrder={0}
      />
    );
    expect(chromeMeshes(renderer.scene)).toHaveLength(1);
  });

  it('draws nothing extra when the port index is out of range', async () => {
    const badPort: GraphEditConnection[] = [{ fromNode: 'Source', fromPort: 5, toNode: 'Sink', toPort: 0 }];
    const renderer = await ReactThreeTestRenderer.create(
      <GraphEdit
        {...painterEnv()}
        childRects={childRects}
        solveNode={graphEdit({ showGrid: false, connections: badPort }, [source, sink])}
        rect={{ x: 0, y: 0, w: 400, h: 100 }}
        renderOrder={0}
      />
    );
    expect(chromeMeshes(renderer.scene)).toHaveLength(1);
  });
});
