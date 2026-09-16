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
    // Chrome off unless a test asks for it: the toolbar and the minimap draw
    // meshes of their own, and every assertion below counts meshes globally.
    properties: { name: 'G', connections: [], showMenu: false, minimapEnabled: false, ...properties } as GraphEditProperties,
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

/**
 * The four meshes GraphEdit's own two scrollbars always add — a track and a
 * grabber each. `_update_scrollbars` grows the range past the page in every
 * GraphEdit with a non-zero rect (`graph_edit.cpp:491-492`), so no property
 * and no fixture can take them away.
 */
const SCROLL_BAR_MESHES = 4;

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
  it('draws one chrome mesh of its own — the background panel — beside the two scrollbars', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphEdit {...painterEnv()} solveNode={graphEdit({ showGrid: false })} rect={RECT} renderOrder={0} />
    );
    expect(chromeMeshes(renderer.scene)).toHaveLength(1 + SCROLL_BAR_MESHES);
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
    expect(chromeMeshes(renderer.scene)).toHaveLength(2 + SCROLL_BAR_MESHES);
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
    expect(chromeMeshes(renderer.scene)).toHaveLength(1 + SCROLL_BAR_MESHES);
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
    expect(chromeMeshes(renderer.scene)).toHaveLength(1 + SCROLL_BAR_MESHES);
  });
});

describe('<GraphEdit> constructor chrome (graph_edit.cpp:3229-3340)', () => {
  const node = graphNode('N', new Map(), [leafControl('Row', 20)]);
  const childRects: ReadonlyMap<string, Rect2> = new Map([['N', { x: 0, y: 0, w: 120, h: 80 }]]);

  function render(properties: Partial<GraphEditProperties>) {
    return ReactThreeTestRenderer.create(
      <GraphEdit
        {...painterEnv()}
        childRects={childRects}
        solveNode={graphEdit({ showGrid: false, ...properties }, [node])}
        rect={{ x: 0, y: 0, w: 400, h: 320 }}
        renderOrder={0}
        subtreeChromeRenderOrder={9}
      />
    );
  }

  // Chrome draws strictly past `subtreeChromeRenderOrder` — top_layer is
  // INTERNAL_MODE_BACK (graph_edit.cpp:3183) — and within that band in
  // top_layer's own child order: scrollbars, toolbar, minimap.
  const TOOLBAR_BAND = 9.4;
  const MINIMAP_BAND = 9.7;

  function band(renderer: Rendered, from: number, to = Infinity) {
    return chromeMeshes(renderer.scene).filter((m) => m.renderOrder > from && m.renderOrder < to);
  }

  it('always draws both scrollbars, track and grabber, below the toolbar band (graph_edit.cpp:491-492)', async () => {
    expect(band(await render({ showMenu: false, minimapEnabled: false }), 9, TOOLBAR_BAND)).toHaveLength(SCROLL_BAR_MESHES);
  });

  it('draws the toolbar panel, each pressed toggle and the spinbox field above the whole subtree', async () => {
    // show_grid false unpresses toggle_grid (:2735) and minimap_enabled false
    // unpresses the minimap button (:2802), leaving toggle_snapping pressed.
    expect(band(await render({ showMenu: true }), TOOLBAR_BAND, MINIMAP_BAND)).toHaveLength(3);
  });

  it('presses toggle_grid as well once show_grid is on (graph_edit.cpp:2729-2737)', async () => {
    expect(band(await render({ showMenu: true, showGrid: true }), TOOLBAR_BAND, MINIMAP_BAND)).toHaveLength(4);
  });

  it('draws no toolbar at all when show_menu is false (graph_edit.cpp:2812-2815)', async () => {
    expect(band(await render({ showMenu: false }), TOOLBAR_BAND, MINIMAP_BAND)).toHaveLength(0);
  });

  it('drops both grid toggles AND the spinbox together when show_grid_buttons is false (:2842-2848)', async () => {
    // Only the panel is left: every remaining button is an unpressed FlatButton,
    // whose normal stylebox is empty (default_theme.cpp:360,367).
    expect(band(await render({ showMenu: true, showGridButtons: false }), TOOLBAR_BAND, MINIMAP_BAND)).toHaveLength(1);
  });

  it('draws the minimap panel, one node rect and the camera rect when enabled', async () => {
    expect(band(await render({ minimapEnabled: true }), MINIMAP_BAND)).toHaveLength(3);
  });

  it('draws no minimap when minimap_enabled is false (graph_edit.cpp:1808-1810)', async () => {
    expect(band(await render({ minimapEnabled: false }), MINIMAP_BAND)).toHaveLength(0);
  });

  it('places the minimap panel bottom-right, inset by MINIMAP_OFFSET (graph_edit.cpp:2773-2778)', async () => {
    const renderer = await render({ minimapEnabled: true });
    const panel = band(renderer, MINIMAP_BAND).reduce((lowest, m) => (m.renderOrder < lowest.renderOrder ? m : lowest));
    renderer.scene.instance.updateMatrixWorld(true);
    const world = new THREE.Vector3();
    panel.getWorldPosition(world);
    // 400 - 240 - 12 across, 320 - 160 - 12 down (negated for three's +Y up).
    expect(world.x).toBeCloseTo(148, 5);
    expect(world.y).toBeCloseTo(-148, 5);
  });
});
