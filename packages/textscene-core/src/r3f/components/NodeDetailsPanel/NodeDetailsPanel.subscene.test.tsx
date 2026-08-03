/**
 * BUG 1 regression: the inspector must resolve a node selected from
 * INSIDE an instanced PackedScene.
 *
 * Pre-fix, `NodeDetailsPanel` looked the selected path up only in
 * `SceneGraph.flattenedNodes` — which contains the inline root scene
 * but NOT the lazily-loaded sub-scene interiors the SceneTreeViewer
 * renders. So clicking a sub-scene interior row (e.g. the lamp's mesh)
 * left the inspector on the "Select a node" placeholder.
 *
 * Post-fix, the panel resolves through `useLiveNode` over the same inline +
 * sub-scene tree the tree shows (descending into sub-scenes through the
 * loader's scene cache, re-deriving on the live-tree version tick), so any
 * tree row resolves — including one selected before its sub-scene loads.
 *
 * Uses the shared `createFakeResourceLoader` fixture (as
 * SceneTreeViewer.subscene-inlining.test.tsx does).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NodeDetailsPanel } from './NodeDetailsPanel';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider, useSelection } from '../../contexts/SelectionContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph';
import { nodeRegistry } from '../../../core/NodeRegistry';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import type { TscnNode, TscnScene, TscnExternalResource } from '../../../parser/types';

function makeNode(name: string, type: string, extras: Partial<TscnNode> = {}): TscnNode {
  return { name, type, children: [], properties: {}, ...extras };
}

function makeExtResource(id: string, path: string, type = 'PackedScene'): TscnExternalResource {
  return { id, path, type };
}

function Selector({ path }: { path: string | null }) {
  const { setSelectedNodePath } = useSelection();
  return (
    <button data-testid="select-node" onClick={() => setSelectedNodePath(path)}>
      select
    </button>
  );
}

function wrap(loader: ResourceLoader, graph: ReturnType<typeof createSceneGraphFromTscnScene>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>
        </SelectionProvider>
      </HierarchyProvider>
    );
  };
}

const LAMP_MESH_TYPE = '___LampMeshType___';
const COIN_ROOT_TYPE = '___CoinRootType___';

afterEach(() => {
  nodeRegistry.unregister(LAMP_MESH_TYPE);
  nodeRegistry.unregister(COIN_ROOT_TYPE);
});

describe('<NodeDetailsPanel> BUG 1 — sub-scene interior selection', () => {
  it('resolves a node INSIDE an instanced PackedScene (not just flattenedNodes)', async () => {
    nodeRegistry.register({
      typeName: LAMP_MESH_TYPE,
      typeGuard: () => false,
      parser: () => ({}),
    });

    const { loader, scenes } = createFakeResourceLoader();

    // Sub-scene (e.g. ceiling_lamp.tscn): a root with an interior mesh node.
    const subScene: TscnScene = {
      nodes: [
        makeNode('ceiling_lamp', 'Node3D', {
          children: [makeNode('plafoniera', LAMP_MESH_TYPE)],
        }),
      ],
      externalResources: [],
      internalResources: [],
    };
    scenes.seed('res://ceiling_lamp.tscn', subScene);

    // Root scene instances the sub-scene at "RoomGeometry/ceiling_lamp".
    const graph = createSceneGraphFromTscnScene({
      nodes: [
        makeNode('RoomGeometry', 'Node3D', {
          children: [
            makeNode('ceiling_lamp', 'Node3D', { instance: 'ExtResource("3_as5ck")' }),
          ],
        }),
      ],
      externalResources: [makeExtResource('3_as5ck', 'res://ceiling_lamp.tscn')],
      internalResources: [],
    });

    // The interior mesh path the tree builds. Instance root merge (ADR-0013)
    // collapses the sub-scene root INTO the instance node, so the interior
    // child sits directly under the instance node's path — no doubled
    // 'ceiling_lamp' wrapper segment.
    const interiorPath = 'RoomGeometry/ceiling_lamp/plafoniera';

    render(
      <>
        <NodeDetailsPanel />
        <Selector path={interiorPath} />
      </>,
      { wrapper: wrap(loader, graph) }
    );

    // Initially placeholder.
    expect(screen.getByText(/Select a node/i)).toBeTruthy();

    await act(async () => {
      screen.getByTestId('select-node').click();
    });

    // Fails pre-fix (placeholder persists because flattenedNodes lacks
    // the sub-scene interior); passes post-fix.
    expect(screen.queryByText(/Select a node/i)).toBeNull();
    expect(screen.getByRole('heading', { name: 'plafoniera' })).toBeTruthy();
    expect(screen.getByText(interiorPath)).toBeTruthy();
  });

  it('resolves a sub-scene interior selected BEFORE the sub-scene loads (late arrival, no pre-seed)', async () => {
    nodeRegistry.register({
      typeName: LAMP_MESH_TYPE,
      typeGuard: () => false,
      parser: () => ({}),
    });

    // The cache is intentionally EMPTY at selection time — unlike the test
    // above, which pre-seeds it. This exercises the version-tick path: the
    // panel must re-resolve when the sub-scene lands, not stick on the
    // placeholder forever (the original BUG 1).
    const { loader, scenes } = createFakeResourceLoader();

    const graph = createSceneGraphFromTscnScene({
      nodes: [
        makeNode('RoomGeometry', 'Node3D', {
          children: [
            makeNode('ceiling_lamp', 'Node3D', { instance: 'ExtResource("3_as5ck")' }),
          ],
        }),
      ],
      externalResources: [makeExtResource('3_as5ck', 'res://ceiling_lamp.tscn')],
      internalResources: [],
    });

    const interiorPath = 'RoomGeometry/ceiling_lamp/plafoniera';

    render(
      <>
        <NodeDetailsPanel />
        <Selector path={interiorPath} />
      </>,
      { wrapper: wrap(loader, graph) }
    );

    // Select the interior while its sub-scene is still loading.
    await act(async () => {
      screen.getByTestId('select-node').click();
    });

    // Unresolvable yet → placeholder (NOT a permanent state).
    expect(screen.getByText(/Select a node/i)).toBeTruthy();

    // The sub-scene lands: cache it and announce it on the bus exactly as the
    // ResourceLoader does. The inspector must pick it up via the live-tree
    // version tick — with no re-selection.
    const subScene: TscnScene = {
      nodes: [
        makeNode('ceiling_lamp', 'Node3D', {
          children: [makeNode('plafoniera', LAMP_MESH_TYPE)],
        }),
      ],
      externalResources: [],
      internalResources: [],
    };
    await act(async () => {
      scenes.seed('res://ceiling_lamp.tscn', subScene);
      loader.eventBus.emit('scene', 'loaded', 'res://ceiling_lamp.tscn');
    });

    expect(screen.queryByText(/Select a node/i)).toBeNull();
    expect(screen.getByRole('heading', { name: 'plafoniera' })).toBeTruthy();
    expect(screen.getByText(interiorPath)).toBeTruthy();
  });

  it('still resolves an inline node', async () => {
    nodeRegistry.register({
      typeName: LAMP_MESH_TYPE,
      typeGuard: () => false,
      parser: () => ({}),
    });

    const { loader } = createFakeResourceLoader();
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('InlineNode', LAMP_MESH_TYPE)],
    });

    render(
      <>
        <NodeDetailsPanel />
        <Selector path="InlineNode" />
      </>,
      { wrapper: wrap(loader, graph) }
    );

    await act(async () => {
      screen.getByTestId('select-node').click();
    });

    expect(screen.queryByText(/Select a node/i)).toBeNull();
    expect(screen.getByRole('heading', { name: 'InlineNode' })).toBeTruthy();
  });
});

describe('<NodeDetailsPanel> BUG 2 — instance root shows the collapsed identity', () => {
  it('shows the merged sub-scene root type for a selected instance ROOT, not the wrapper', async () => {
    nodeRegistry.register({
      typeName: COIN_ROOT_TYPE,
      typeGuard: () => false,
      parser: () => ({}),
    });

    const { loader, scenes } = createFakeResourceLoader();

    // Single-root sub-scene → Instance root merge (ADR-0013): the instance node
    // ADOPTS the sub-scene root's type/properties. The tree row + viewport show
    // this collapsed identity; the inspector must agree.
    const subScene: TscnScene = {
      nodes: [makeNode('CoinBody', COIN_ROOT_TYPE)],
      externalResources: [],
      internalResources: [],
    };
    scenes.seed('res://coin.tscn', subScene);

    // Root scene: a top-level instance node whose WRAPPER type is Node3D.
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Coin1', 'Node3D', { instance: 'ExtResource("7_coin")' })],
      externalResources: [makeExtResource('7_coin', 'res://coin.tscn')],
      internalResources: [],
    });

    render(
      <>
        <NodeDetailsPanel />
        <Selector path="Coin1" />
      </>,
      { wrapper: wrap(loader, graph) }
    );

    await act(async () => {
      screen.getByTestId('select-node').click();
    });

    // The merged node keeps the instance name but adopts the root's type.
    expect(screen.getByRole('heading', { name: 'Coin1' })).toBeTruthy();
    expect(screen.getByText(COIN_ROOT_TYPE)).toBeTruthy();
    // Pre-fix the flattenedNodes fast-path returned the RAW wrapper, so the
    // inspector showed the wrapper type 'Node3D' instead of the collapsed type.
    expect(screen.queryByText('Node3D')).toBeNull();
    // ...but it must STILL signal that this is an instanced external scene —
    // parity with the tree's 📦 badge, which keys off the ORIGINATING instance
    // ref (the merged node's own `instance` is the sub-scene root's, undefined
    // for a plain root, so the row must come from the originating ref).
    expect(screen.getByText(/External/i)).toBeTruthy();
    expect(screen.getByText('ExtResource("7_coin")')).toBeTruthy();
  });
});
