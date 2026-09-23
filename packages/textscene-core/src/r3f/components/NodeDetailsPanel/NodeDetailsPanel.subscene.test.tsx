/**
 * The inspector resolves a node selected inside an instanced PackedScene.
 * `SceneGraph.flattenedNodes` lacks the lazily loaded sub-scene interiors, so
 * the panel resolves through `useLiveNode` over the tree the outliner shows,
 * and re-derives on the live-tree version tick when a sub-scene lands.
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

    // The sub-scene: a root with an interior mesh node.
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

    // Instance root merge (ADR-0013) collapses the sub-scene root into the
    // instance node, so the interior child sits directly under its path.
    const interiorPath = 'RoomGeometry/ceiling_lamp/plafoniera';

    render(
      <>
        <NodeDetailsPanel />
        <Selector path={interiorPath} />
      </>,
      { wrapper: wrap(loader, graph) }
    );

    expect(screen.getByText(/Select a node/i)).toBeTruthy();

    await act(async () => {
      screen.getByTestId('select-node').click();
    });

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

    // The cache is empty at selection time, so the panel must re-resolve on the
    // version tick when the sub-scene lands.
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

    // Unresolvable yet, so the placeholder shows for now.
    expect(screen.getByText(/Select a node/i)).toBeTruthy();

    // The sub-scene lands as the ResourceLoader announces it. The inspector picks
    // it up through the version tick, with no re-selection.
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

    // Instance root merge (ADR-0013): the instance node adopts the sub-scene
    // root's type and properties, and the inspector agrees with the tree.
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
    expect(screen.queryByText('Node3D')).toBeNull();
    // It still shows the external-instance row, as the tree's 📦 badge does. The
    // merged node's own `instance` is undefined for a plain root, so the row
    // reads the originating instance ref.
    expect(screen.getByText(/External/i)).toBeTruthy();
    expect(screen.getByText('ExtResource("7_coin")')).toBeTruthy();
  });
});
