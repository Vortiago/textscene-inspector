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
 * Post-fix, the panel walks the same inline + sub-scene tree the tree
 * shows (via `resolveNodeByPath`, descending into sub-scenes through the
 * loader's scene cache), so any tree row resolves.
 *
 * The loader stub mirrors the one in
 * SceneTreeViewer.subscene-inlining.test.tsx.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { NodeDetailsPanel } from './NodeDetailsPanel';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider, useSelection } from '../../contexts/SelectionContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { ResourceEventBus } from '../../../resources/ResourceEventBus';
import { MetadataStore } from '../../../resources/MetadataStore';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph';
import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import type { TscnNode, TscnScene, TscnExternalResource } from '../../../parser/types';

function makeLoader(): {
  loader: ResourceLoader;
  setSceneCached: (path: string, scene: TscnScene) => void;
} {
  const eventBus = new ResourceEventBus();
  const metadata = new MetadataStore();
  const sceneCache = new Map<string, TscnScene | null>();
  const textureCache = new Map<string, THREE.Texture | null>();
  const materialCache = new Map<string, THREE.Material | null>();
  const glbCache = new Map<string, THREE.Object3D | null>();

  const makeProc = <T,>(cache: Map<string, T | null>) => ({
    request: () => {},
    getCached: (p: string) => cache.get(p),
    isCached: (p: string) => cache.has(p),
    isLoading: () => false,
    clearCache: () => {},
    getCacheSize: () => cache.size,
  });

  const loader = {
    eventBus,
    metadata,
    textures: makeProc<THREE.Texture>(textureCache),
    materials: makeProc<THREE.Material>(materialCache),
    glbMeshes: makeProc<THREE.Object3D>(glbCache),
    scenes: makeProc<TscnScene>(sceneCache),
    getSceneCached: (p: string) => sceneCache.get(p),
    requestScene: () => {},
    register: () => {},
    provideFile: () => {},
    clear: () => {
      sceneCache.clear();
    },
  } as unknown as ResourceLoader;

  return { loader, setSceneCached: (path, scene) => sceneCache.set(path, scene) };
}

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

afterEach(() => {
  const registrations = (nodeRegistry as unknown as {
    registrations: Map<string, NodeTypeRegistration>;
  }).registrations;
  registrations.delete(LAMP_MESH_TYPE);
});

describe('<NodeDetailsPanel> BUG 1 — sub-scene interior selection', () => {
  it('resolves a node INSIDE an instanced PackedScene (not just flattenedNodes)', async () => {
    nodeRegistry.register({
      typeName: LAMP_MESH_TYPE,
      typeGuard: () => false,
      parser: () => ({}),
      renderer: () => null as never,
    });

    const { loader, setSceneCached } = makeLoader();

    // Sub-scene (e.g. roof_lamp.tscn): a root with an interior mesh node.
    const subScene: TscnScene = {
      nodes: [
        makeNode('roof_lamp', 'Node3D', {
          children: [makeNode('plafoniera', LAMP_MESH_TYPE)],
        }),
      ],
      externalResources: [],
      internalResources: [],
    };
    setSceneCached('res://roof_lamp.tscn', subScene);

    // Root scene instances the sub-scene at "HallwayGeometry/roof_lamp".
    const graph = createSceneGraphFromTscnScene({
      nodes: [
        makeNode('HallwayGeometry', 'Node3D', {
          children: [
            makeNode('roof_lamp', 'Node3D', { instance: 'ExtResource("3_as5ck")' }),
          ],
        }),
      ],
      externalResources: [makeExtResource('3_as5ck', 'res://roof_lamp.tscn')],
      internalResources: [],
    });

    // The interior mesh path the tree builds. Instance root merge (ADR-0013)
    // collapses the sub-scene root INTO the instance node, so the interior
    // child sits directly under the instance node's path — no doubled
    // 'roof_lamp' wrapper segment.
    const interiorPath = 'HallwayGeometry/roof_lamp/plafoniera';

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

  it('still resolves an inline node via the flattenedNodes fast path', async () => {
    nodeRegistry.register({
      typeName: LAMP_MESH_TYPE,
      typeGuard: () => false,
      parser: () => ({}),
      renderer: () => null as never,
    });

    const { loader } = makeLoader();
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
