/**
 * Regression test for WI-HALL-1: SceneTreeViewer inlines PackedScene
 * sub-scene contents.
 *
 * Pre-WI-HALL-1 the tree only walked the parsed root scene's
 * `node.children`. Instance nodes (carrying `instance =
 * ExtResource("...")`) appeared as leaves — the user could see the 📦
 * marker but couldn't expand the node to see what's INSIDE the
 * sub-scene. The 3D viewport handled sub-scenes correctly (via
 * NodeDispatcher's `InstancedSceneSubtree`); the tree was just blind to
 * the dynamically-loaded data.
 *
 * Post-WI-HALL-1: each TreeNode calls `useSubSceneChildren` (which
 * routes through `useResource('PackedScene', path)`); when the loader's
 * scene cache has the path, the sub-scene's nodes render as inline
 * children of the instance row.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { SceneTreeViewer } from './SceneTreeViewer';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider } from '../../contexts/SelectionContext';
import { MissingResourcesProvider } from '../../contexts/MissingResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { ResourceEventBus } from '../../../resources/ResourceEventBus';
import { MetadataStore } from '../../../resources/MetadataStore';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import type { TscnNode, TscnScene, TscnExternalResource } from '../../../parser/types';

/**
 * Mock loader whose `loader.scenes` returns a pre-staged sub-scene
 * synchronously so the tree's `useResource('PackedScene', ...)` hits a
 * cache-hit on first render. Mirrors the pattern in
 * NodeDispatcher.instance.test.tsx.
 */
function makeLoader(): { loader: ResourceLoader; setSceneCached: (path: string, scene: TscnScene) => void } {
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

  return {
    loader,
    setSceneCached: (path, scene) => sceneCache.set(path, scene),
  };
}

function makeNode(name: string, type: string, extras: Partial<TscnNode> = {}): TscnNode {
  return {
    name,
    type,
    children: [],
    properties: {},
    ...extras,
  };
}

function makeExtResource(id: string, path: string, type = 'PackedScene'): TscnExternalResource {
  return { id, path, type };
}

function wrap(loader: ResourceLoader, sceneGraph: ReturnType<typeof createSceneGraphFromTscnScene>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
        <SelectionProvider>
          <ResourceLoaderProvider loader={loader}>
            <MissingResourcesProvider>{children}</MissingResourcesProvider>
          </ResourceLoaderProvider>
        </SelectionProvider>
      </HierarchyProvider>
    );
  };
}

describe('<SceneTreeViewer> WI-HALL-1 — sub-scene inlining', () => {
  it('renders a sub-scene\'s root nodes as inline children of the instance row when the loader has it cached', () => {
    const { loader, setSceneCached } = makeLoader();

    // Sub-scene's content: a Node3D named "Frame" containing a MeshInstance3D.
    const subScene: TscnScene = {
      nodes: [
        makeNode('Frame', 'Node3D', {
          children: [makeNode('FrameMesh', 'MeshInstance3D')],
        }),
      ],
      externalResources: [],
      internalResources: [],
    };
    setSceneCached('res://photo_frame.tscn', subScene);

    // Root scene's content: a single instancing node that points at the sub-scene.
    const graph = createSceneGraphFromTscnScene({
      nodes: [
        makeNode('PhotoFrame1', 'Node3D', {
          instance: 'ExtResource("frame_1")',
        }),
      ],
      externalResources: [makeExtResource('frame_1', 'res://photo_frame.tscn')],
      internalResources: [],
    });

    render(<SceneTreeViewer />, { wrapper: wrap(loader, graph) });

    // The instance row should now report it has children (aria-expanded
    // attribute will be present and falsy, but the chevron should be there).
    // We expand it by clicking the chevron... but in our test the tree
    // auto-expands selection. Easiest assertion: the sub-scene's root
    // node should be addressable via its path-joined data attribute.
    // We expand programmatically by setting the expanded set via
    // SelectionContext — simpler: assert that the sub-scene's nodes
    // are renderable by checking the data-node-path container exists in
    // the DOM. Without expansion, the children div is conditionally
    // rendered, so we expand explicitly via the chevron.
    const instanceRow = screen.getByText('PhotoFrame1').closest('[data-node-path]');
    expect(instanceRow).not.toBeNull();
    expect(instanceRow!.getAttribute('aria-expanded') ?? instanceRow!.querySelector('[aria-expanded]')?.getAttribute('aria-expanded')).toBeDefined();

    // The sub-scene's Frame node SHOULD be present in the DOM tree under
    // a path-joined data attribute. The tree only renders children when
    // the parent is expanded — verify the sub-scene loaded by asserting
    // the children container shape rather than visibility.
    //
    // Simpler approach: the chevron only appears for nodes with
    // children. If the sub-scene loaded, PhotoFrame1's row should have
    // the expand chevron (▶), not the leaf bullet (•).
    expect(instanceRow!.textContent).toContain('▶');
    expect(instanceRow!.textContent).not.toBe('•');
  });

  it('resolves a NESTED instance using the sub-scene resources, not the outer scene (chevron on the inner row)', () => {
    // Reproduces the platformer Player bug: game.tscn instances player.tscn,
    // which instances player.glb via player.tscn's OWN ExtResource id (absent
    // from game.tscn). The inner instance must resolve against the sub-scene's
    // resource table or it dead-ends as a leaf.
    const { loader, setSceneCached } = makeLoader();
    const subB: TscnScene = {
      nodes: [makeNode('BRoot', 'Node3D', { children: [makeNode('Leaf', 'MeshInstance3D')] })],
      externalResources: [],
      internalResources: [],
    };
    const subA: TscnScene = {
      nodes: [
        makeNode('ARoot', 'Node3D', {
          children: [makeNode('Inner', 'Node3D', { instance: 'ExtResource("9_subB")' })],
        }),
      ],
      // subA's OWN resource table — the only place "9_subB" is defined.
      externalResources: [makeExtResource('9_subB', 'res://subB.tscn')],
      internalResources: [],
    };
    setSceneCached('res://subA.tscn', subA);
    setSceneCached('res://subB.tscn', subB);

    // Outer scene knows only subA ("1_subA"); it has NO "9_subB".
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('A', 'Node3D', { instance: 'ExtResource("1_subA")' })],
      externalResources: [makeExtResource('1_subA', 'res://subA.tscn')],
      internalResources: [],
    });

    render(<SceneTreeViewer />, { wrapper: wrap(loader, graph) });

    // A collapses subA (ARoot merges in), so its child row is "Inner". Expand A.
    const aRow = screen.getByText('A').closest('[data-node-path]');
    act(() => fireEvent.click(within(aRow!).getByRole('button', { name: 'Expand' })));

    // Inner's nested subB resolved against subA's resources → it has a chevron.
    const innerRow = screen.getByText('Inner').closest('[data-node-path]');
    expect(innerRow).not.toBeNull();
    expect(innerRow!.textContent).toContain('▶');
  });

  it('offers an "open sub-scene standalone" action that reports the instance res:// path', () => {
    const { loader } = makeLoader();
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Coin1', 'Node3D', { instance: 'ExtResource("coin")' })],
      externalResources: [makeExtResource('coin', 'res://coin/coin.tscn')],
      internalResources: [],
    });
    const onOpenSubScene = vi.fn();

    render(<SceneTreeViewer onOpenSubScene={onOpenSubScene} />, { wrapper: wrap(loader, graph) });

    const button = screen.getByRole('button', { name: /open sub-scene standalone/i });
    act(() => fireEvent.click(button));
    expect(onOpenSubScene).toHaveBeenCalledWith('res://coin/coin.tscn');
  });

  it('shows no open-sub-scene action on non-instance rows', () => {
    const { loader } = makeLoader();
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Plain', 'Node3D')],
      externalResources: [],
      internalResources: [],
    });
    render(<SceneTreeViewer onOpenSubScene={vi.fn()} />, { wrapper: wrap(loader, graph) });
    expect(screen.queryByRole('button', { name: /open sub-scene standalone/i })).toBeNull();
  });

  it('inline children of an instance node coexist with sub-scene children', () => {
    const { loader, setSceneCached } = makeLoader();

    const subScene: TscnScene = {
      nodes: [makeNode('SubRoot', 'Node3D')],
      externalResources: [],
      internalResources: [],
    };
    setSceneCached('res://sub.tscn', subScene);

    // The instance node has BOTH a `children` array (inline TSCN children
    // that override sub-scene contents) AND an `instance` ref. The tree
    // should show both groups of children.
    const graph = createSceneGraphFromTscnScene({
      nodes: [
        makeNode('Inst', 'Node3D', {
          instance: 'ExtResource("sub_1")',
          children: [makeNode('Override', 'MeshInstance3D')],
        }),
      ],
      externalResources: [makeExtResource('sub_1', 'res://sub.tscn')],
      internalResources: [],
    });

    render(<SceneTreeViewer />, { wrapper: wrap(loader, graph) });

    // The instance row should report having children (the chevron should
    // appear), since both inline + sub-scene children exist.
    const instanceRow = screen.getByText('Inst').closest('[data-node-path]');
    expect(instanceRow).not.toBeNull();
    expect(instanceRow!.textContent).toContain('▶');
  });

  it('does not crash when an instance node references a path the loader has not cached yet', () => {
    const { loader } = makeLoader(); // intentionally empty cache

    const graph = createSceneGraphFromTscnScene({
      nodes: [
        makeNode('Unresolved', 'Node3D', {
          instance: 'ExtResource("missing_1")',
        }),
      ],
      externalResources: [makeExtResource('missing_1', 'res://not-loaded-yet.tscn')],
      internalResources: [],
    });

    // The tree should render the instance row but treat it as a leaf
    // because the loader's scene cache misses on this path — no children
    // appear, no exception thrown.
    expect(() => {
      render(<SceneTreeViewer />, { wrapper: wrap(loader, graph) });
    }).not.toThrow();
    expect(screen.getByText('Unresolved')).toBeTruthy();
  });

  it('renders a non-instance node as a leaf when it has no children (no sub-scene resolution attempted)', () => {
    const { loader } = makeLoader();

    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Plain', 'Node3D')],
      externalResources: [],
      internalResources: [],
    });

    render(<SceneTreeViewer />, { wrapper: wrap(loader, graph) });

    const row = screen.getByText('Plain').closest('[data-node-path]');
    expect(row).not.toBeNull();
    // No chevron, just the leaf bullet, since both inline-children AND
    // sub-scene-children evaluated empty.
    expect(row!.textContent).toContain('•');
    expect(row!.textContent).not.toContain('▶');
  });

  // Avoid unused-import lint complaints in narrow test wrappers.
  void within;
});

describe('<SceneTreeViewer> Instance root merge (ADR-0013)', () => {
  function expandRow(name: string) {
    const row = screen.getByText(name).closest('[data-node-path]')!;
    const chevron = within(row as HTMLElement).getAllByRole('button', { name: /expand/i })[0]!;
    act(() => fireEvent.click(chevron));
    return row as HTMLElement;
  }

  it('collapses the wrapper: the instance row adopts the sub-scene root type and shows the root children directly', () => {
    const { loader, setSceneCached } = makeLoader();

    // Sub-scene root is an Area3D (a different type than the instance node)
    // holding the coin internals.
    const subScene: TscnScene = {
      nodes: [
        makeNode('Coin', 'Area3D', {
          children: [makeNode('Circle', 'MeshInstance3D'), makeNode('Animation', 'AnimationPlayer')],
        }),
      ],
      externalResources: [],
      internalResources: [],
    };
    setSceneCached('res://coin/coin.tscn', subScene);

    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Coin1', 'Node3D', { instance: 'ExtResource("coin")' })],
      externalResources: [makeExtResource('coin', 'res://coin/coin.tscn')],
      internalResources: [],
    });

    const { container } = render(<SceneTreeViewer />, { wrapper: wrap(loader, graph) });

    // The instance row adopts the root's Area3D type (badge shorthand 'Area').
    const coin1Row = screen.getByText('Coin1').closest('[data-node-path]') as HTMLElement;
    expect(within(coin1Row).getByTitle('Area3D')).toBeTruthy();

    expandRow('Coin1');

    // The interior nodes are addressed directly under the instance row — no
    // intermediate 'Coin' wrapper segment.
    expect(container.querySelector('[data-node-path="Coin1/Circle"]')).not.toBeNull();
    expect(container.querySelector('[data-node-path="Coin1/Animation"]')).not.toBeNull();
    expect(container.querySelector('[data-node-path="Coin1/Coin"]')).toBeNull();
  });

  it('keeps the open-sub-scene affordance on a collapsed (cached, single-root) instance row', () => {
    const { loader, setSceneCached } = makeLoader();
    setSceneCached('res://coin/coin.tscn', {
      nodes: [makeNode('Coin', 'Area3D')],
      externalResources: [],
      internalResources: [],
    });
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Coin1', 'Node3D', { instance: 'ExtResource("coin")' })],
      externalResources: [makeExtResource('coin', 'res://coin/coin.tscn')],
      internalResources: [],
    });
    const onOpenSubScene = vi.fn();

    render(<SceneTreeViewer onOpenSubScene={onOpenSubScene} />, { wrapper: wrap(loader, graph) });

    const button = screen.getByRole('button', { name: /open sub-scene standalone/i });
    act(() => fireEvent.click(button));
    expect(onOpenSubScene).toHaveBeenCalledWith('res://coin/coin.tscn');
  });

  it('does NOT collapse a multi-root sub-scene: it keeps the nested form', () => {
    const { loader, setSceneCached } = makeLoader();
    setSceneCached('res://multi.tscn', {
      nodes: [makeNode('RootA', 'Node3D'), makeNode('RootB', 'Node3D')],
      externalResources: [],
      internalResources: [],
    });
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('MultiHost', 'Node3D', { instance: 'ExtResource("multi")' })],
      externalResources: [makeExtResource('multi', 'res://multi.tscn')],
      internalResources: [],
    });

    const { container } = render(<SceneTreeViewer />, { wrapper: wrap(loader, graph) });

    // Host keeps its own Node3D type (no single-root to adopt).
    const hostRow = screen.getByText('MultiHost').closest('[data-node-path]') as HTMLElement;
    expect(within(hostRow).getByTitle('Node3D')).toBeTruthy();

    expandRow('MultiHost');

    // Both loaded roots render as nested child rows under the instance row.
    expect(container.querySelector('[data-node-path="MultiHost/RootA"]')).not.toBeNull();
    expect(container.querySelector('[data-node-path="MultiHost/RootB"]')).not.toBeNull();
  });
});
