/**
 * The outliner inlines a PackedScene's contents under its instance row. Each
 * TreeNode calls `useSubSceneChildren`, so the sub-scene's nodes render as
 * children once the loader's scene cache has the path.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SceneTreeViewer } from './SceneTreeViewer';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider } from '../../contexts/SelectionContext';
import { MissingResourcesProvider } from '../../contexts/MissingResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import type { TscnNode, TscnScene, TscnExternalResource } from '../../../parser/types';

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
    const fake = createFakeResourceLoader();

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
    fake.scenes.seed('res://photo_frame.tscn', subScene);

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

    render(<SceneTreeViewer />, { wrapper: wrap(fake.loader, graph) });

    const instanceRow = screen.getByText('PhotoFrame1').closest('[data-node-path]');
    expect(instanceRow).not.toBeNull();
    expect(instanceRow!.getAttribute('aria-expanded') ?? instanceRow!.querySelector('[aria-expanded]')?.getAttribute('aria-expanded')).toBeDefined();

    // Only a row with children has the chevron (▶), not the leaf bullet (•).
    expect(instanceRow!.textContent).toContain('▶');
    expect(instanceRow!.textContent).not.toBe('•');
  });

  it('resolves a NESTED instance using the sub-scene resources, not the outer scene (chevron on the inner row)', () => {
    // The inner instance uses an ExtResource id that only the sub-scene declares,
    // so it resolves against the sub-scene's resource table.
    const fake = createFakeResourceLoader();
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
      // subA's own resource table is the only place "9_subB" is defined.
      externalResources: [makeExtResource('9_subB', 'res://subB.tscn')],
      internalResources: [],
    };
    fake.scenes.seed('res://subA.tscn', subA);
    fake.scenes.seed('res://subB.tscn', subB);

    // The outer scene knows only subA ("1_subA"), not "9_subB".
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('A', 'Node3D', { instance: 'ExtResource("1_subA")' })],
      externalResources: [makeExtResource('1_subA', 'res://subA.tscn')],
      internalResources: [],
    });

    render(<SceneTreeViewer />, { wrapper: wrap(fake.loader, graph) });

    // A collapses subA (ARoot merges in), so its child row is "Inner". Expand A.
    const aRow = screen.getByText('A').closest('[data-node-path]') as HTMLElement;
    act(() => fireEvent.click(within(aRow).getByRole('button', { name: 'Expand' })));

    // Inner's nested subB resolves against subA's resources, so it has a chevron.
    const innerRow = screen.getByText('Inner').closest('[data-node-path]');
    expect(innerRow).not.toBeNull();
    expect(innerRow!.textContent).toContain('▶');
  });

  it('offers an "open sub-scene standalone" action that reports the instance res:// path', () => {
    const fake = createFakeResourceLoader();
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Coin1', 'Node3D', { instance: 'ExtResource("coin")' })],
      externalResources: [makeExtResource('coin', 'res://coin/coin.tscn')],
      internalResources: [],
    });
    const onOpenSubScene = vi.fn();

    render(<SceneTreeViewer onOpenSubScene={onOpenSubScene} />, { wrapper: wrap(fake.loader, graph) });

    const button = screen.getByRole('button', { name: /open sub-scene standalone/i });
    act(() => fireEvent.click(button));
    expect(onOpenSubScene).toHaveBeenCalledWith('res://coin/coin.tscn');
  });

  it('shows no open-sub-scene action on non-instance rows', () => {
    const fake = createFakeResourceLoader();
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Plain', 'Node3D')],
      externalResources: [],
      internalResources: [],
    });
    render(<SceneTreeViewer onOpenSubScene={vi.fn()} />, { wrapper: wrap(fake.loader, graph) });
    expect(screen.queryByRole('button', { name: /open sub-scene standalone/i })).toBeNull();
  });

  it('inline children of an instance node coexist with sub-scene children', () => {
    const fake = createFakeResourceLoader();

    const subScene: TscnScene = {
      nodes: [makeNode('SubRoot', 'Node3D')],
      externalResources: [],
      internalResources: [],
    };
    fake.scenes.seed('res://sub.tscn', subScene);

    // The instance node has both inline children and an `instance` ref. The
    // tree shows both groups.
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

    render(<SceneTreeViewer />, { wrapper: wrap(fake.loader, graph) });

    // Both groups exist, so the chevron appears.
    const instanceRow = screen.getByText('Inst').closest('[data-node-path]');
    expect(instanceRow).not.toBeNull();
    expect(instanceRow!.textContent).toContain('▶');
  });

  it('does not crash when an instance node references a path the loader has not cached yet', () => {
    const fake = createFakeResourceLoader(); // intentionally empty cache

    const graph = createSceneGraphFromTscnScene({
      nodes: [
        makeNode('Unresolved', 'Node3D', {
          instance: 'ExtResource("missing_1")',
        }),
      ],
      externalResources: [makeExtResource('missing_1', 'res://not-loaded-yet.tscn')],
      internalResources: [],
    });

    // A scene-cache miss renders the instance row as a leaf, with no exception.
    expect(() => {
      render(<SceneTreeViewer />, { wrapper: wrap(fake.loader, graph) });
    }).not.toThrow();
    expect(screen.getByText('Unresolved')).toBeTruthy();
  });

  it('renders a non-instance node as a leaf when it has no children (no sub-scene resolution attempted)', () => {
    const fake = createFakeResourceLoader();

    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Plain', 'Node3D')],
      externalResources: [],
      internalResources: [],
    });

    render(<SceneTreeViewer />, { wrapper: wrap(fake.loader, graph) });

    const row = screen.getByText('Plain').closest('[data-node-path]');
    expect(row).not.toBeNull();
    // Both groups are empty, so the row has the leaf bullet.
    expect(row!.textContent).toContain('•');
    expect(row!.textContent).not.toContain('▶');
  });
});

describe('<SceneTreeViewer> Instance root merge (ADR-0013)', () => {
  function expandRow(name: string) {
    const row = screen.getByText(name).closest('[data-node-path]')!;
    const chevron = within(row as HTMLElement).getAllByRole('button', { name: /expand/i })[0]!;
    act(() => fireEvent.click(chevron));
    return row as HTMLElement;
  }

  it('collapses the wrapper: the instance row adopts the sub-scene root type and shows the root children directly', () => {
    const fake = createFakeResourceLoader();

    // The sub-scene root is an Area3D, a type other than the instance node's.
    const subScene: TscnScene = {
      nodes: [
        makeNode('Coin', 'Area3D', {
          children: [makeNode('Circle', 'MeshInstance3D'), makeNode('Animation', 'AnimationPlayer')],
        }),
      ],
      externalResources: [],
      internalResources: [],
    };
    fake.scenes.seed('res://coin/coin.tscn', subScene);

    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Coin1', 'Node3D', { instance: 'ExtResource("coin")' })],
      externalResources: [makeExtResource('coin', 'res://coin/coin.tscn')],
      internalResources: [],
    });

    const { container } = render(<SceneTreeViewer />, { wrapper: wrap(fake.loader, graph) });

    // The instance row adopts the root's Area3D type (badge shorthand 'Area').
    const coin1Row = screen.getByText('Coin1').closest('[data-node-path]') as HTMLElement;
    expect(within(coin1Row).getByTitle('Area3D')).toBeTruthy();

    expandRow('Coin1');

    // The interior nodes sit directly under the instance row, with no 'Coin' segment.
    expect(container.querySelector('[data-node-path="Coin1/Circle"]')).not.toBeNull();
    expect(container.querySelector('[data-node-path="Coin1/Animation"]')).not.toBeNull();
    expect(container.querySelector('[data-node-path="Coin1/Coin"]')).toBeNull();
  });

  it('keeps the open-sub-scene affordance on a collapsed (cached, single-root) instance row', () => {
    const fake = createFakeResourceLoader();
    fake.scenes.seed('res://coin/coin.tscn', {
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

    render(<SceneTreeViewer onOpenSubScene={onOpenSubScene} />, { wrapper: wrap(fake.loader, graph) });

    const button = screen.getByRole('button', { name: /open sub-scene standalone/i });
    act(() => fireEvent.click(button));
    expect(onOpenSubScene).toHaveBeenCalledWith('res://coin/coin.tscn');
  });

  it('does NOT collapse a multi-root sub-scene: it keeps the nested form', () => {
    const fake = createFakeResourceLoader();
    fake.scenes.seed('res://multi.tscn', {
      nodes: [makeNode('RootA', 'Node3D'), makeNode('RootB', 'Node3D')],
      externalResources: [],
      internalResources: [],
    });
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('MultiHost', 'Node3D', { instance: 'ExtResource("multi")' })],
      externalResources: [makeExtResource('multi', 'res://multi.tscn')],
      internalResources: [],
    });

    const { container } = render(<SceneTreeViewer />, { wrapper: wrap(fake.loader, graph) });

    // Host keeps its own Node3D type (no single-root to adopt).
    const hostRow = screen.getByText('MultiHost').closest('[data-node-path]') as HTMLElement;
    expect(within(hostRow).getByTitle('Node3D')).toBeTruthy();

    expandRow('MultiHost');

    // Both loaded roots render as nested child rows under the instance row.
    expect(container.querySelector('[data-node-path="MultiHost/RootA"]')).not.toBeNull();
    expect(container.querySelector('[data-node-path="MultiHost/RootB"]')).not.toBeNull();
  });

  it('search reaches a node inside an instanced sub-scene, keeping the instance row visible', () => {
    const fake = createFakeResourceLoader();
    fake.scenes.seed('res://frame.tscn', {
      nodes: [makeNode('FrameRoot', 'Node3D', { children: [makeNode('SpecialMesh', 'MeshInstance3D')] })],
      externalResources: [],
      internalResources: [],
    });
    const graph = createSceneGraphFromTscnScene({
      nodes: [
        makeNode('Frame', 'Node3D', { instance: 'ExtResource("f")' }),
        makeNode('Other', 'Node3D'),
      ],
      externalResources: [makeExtResource('f', 'res://frame.tscn')],
      internalResources: [],
    });

    render(<SceneTreeViewer />, { wrapper: wrap(fake.loader, graph) });

    // Expand the instance so its sub-scene rows render.
    expandRow('Frame');
    expect(screen.getByText('SpecialMesh')).toBeTruthy();

    // The search walks the live tree: it keeps the instance row, an ancestor of
    // the match, and hides only the unrelated sibling.
    act(() =>
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'special' } })
    );
    expect(screen.getByText('Frame')).toBeTruthy();
    expect(screen.getByText('SpecialMesh')).toBeTruthy();
    expect(screen.queryByText('Other')).toBeNull();
  });
});
