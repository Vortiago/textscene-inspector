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
import { ExpandedRowsProvider } from './expandedRows';
import { MissingResourcesProvider } from '../../contexts/MissingResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import {
  createFakeResourceLoader,
  recordSceneRequests,
} from '../../../resources/testing/createFakeResourceLoader';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import type { TscnNode, TscnScene, TscnExternalResource } from '../../../parser/types';
import { INSTANTIABLE_SCENE } from '../../../parser/sceneDefaults.testkit';
// The Instance root merge parses a sub-scene root with the Node parser when its type has none.
import '../../../nodes/node/index';
import { TscnParser } from '../../../parser/TscnParser';

const parse = (text: string): TscnScene => new TscnParser().parse(`[gd_scene format=3]\n\n${text}`);

function makeNode(name: string, type: string, extras: Partial<TscnNode> = {}): TscnNode {
  return { rawProperties: {}, name, type, children: [], properties: {}, ...extras };
}

function makeExtResource(id: string, path: string, type = 'PackedScene'): TscnExternalResource {
  return { id, path, type };
}

function wrap(loader: ResourceLoader, sceneGraph: ReturnType<typeof createSceneGraphFromTscnScene>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
        <SelectionProvider>
          <ExpandedRowsProvider>
            <ResourceLoaderProvider loader={loader}>
              <MissingResourcesProvider>{children}</MissingResourcesProvider>
            </ResourceLoaderProvider>
          </ExpandedRowsProvider>
        </SelectionProvider>
      </HierarchyProvider>
    );
  };
}

describe('<SceneTreeViewer> WI-HALL-1 — sub-scene inlining', () => {
  it("renders a sub-scene's root nodes as inline children of the instance row when the loader has it cached", () => {
    const fake = createFakeResourceLoader();

    fake.scenes.seed(
      'res://photo_frame.tscn',
      parse(`[node name="Frame" type="Node3D"]

[node name="FrameMesh" type="MeshInstance3D" parent="."]
`)
    );

    // The root instances the sub-scene, so the scene inherits it and owns its nodes.
    const graph = createSceneGraphFromTscnScene(
      parse(`[ext_resource type="PackedScene" path="res://photo_frame.tscn" id="frame_1"]

[node name="PhotoFrame1" instance=ExtResource("frame_1")]
`)
    );

    render(<SceneTreeViewer />, { wrapper: wrap(fake.loader, graph) });

    const instanceRow = screen.getByText('PhotoFrame1').closest('[data-node-path]');
    expect(instanceRow).not.toBeNull();
    expect(
      instanceRow!.getAttribute('aria-expanded') ??
        instanceRow!.querySelector('[aria-expanded]')?.getAttribute('aria-expanded')
    ).toBeDefined();

    // Only a row with children has the chevron (▶), not the leaf bullet (•).
    expect(instanceRow!.textContent).toContain('▶');
    expect(instanceRow!.textContent).not.toBe('•');
  });

  it('resolves a NESTED instance using the sub-scene resources, not the outer scene (chevron on the inner row)', () => {
    // The inner instance uses an ExtResource id that only the sub-scene declares,
    // so it resolves against the sub-scene's resource table.
    const fake = createFakeResourceLoader();
    fake.scenes.seed(
      'res://subB.tscn',
      parse(`[node name="BRoot" type="Node3D"]

[node name="Leaf" type="MeshInstance3D" parent="."]
`)
    );
    // subA's own resource table is the only place "9_subB" is defined.
    fake.scenes.seed(
      'res://subA.tscn',
      parse(`[ext_resource type="PackedScene" path="res://subB.tscn" id="9_subB"]

[node name="ARoot" type="Node3D"]

[node name="Inner" parent="." instance=ExtResource("9_subB")]
`)
    );

    // The outer scene knows only subA ("1_subA"), not "9_subB". Inner is editable, so its nodes list.
    const graph = createSceneGraphFromTscnScene(
      parse(`[ext_resource type="PackedScene" path="res://subA.tscn" id="1_subA"]

[node name="A" instance=ExtResource("1_subA")]

[editable path="Inner"]
`)
    );

    render(<SceneTreeViewer />, { wrapper: wrap(fake.loader, graph) });

    // A collapses subA (ARoot merges in), so its child row is "Inner". Expand A.
    const aRow = screen.getByText('A').closest('[data-node-path]') as HTMLElement;
    act(() => fireEvent.click(within(aRow).getByRole('button', { name: 'Expand' })));

    // Inner's nested subB resolves against subA's resources, so it has a chevron.
    const innerRow = screen.getByText('Inner').closest('[data-node-path]');
    expect(innerRow).not.toBeNull();
    expect(innerRow!.textContent).toContain('▶');
  });

  it("registers the sub-scene's ExtResource before the scene load requests it", () => {
    const fake = createFakeResourceLoader();
    const metadataAtRequest = recordSceneRequests(fake);
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('PhotoFrame1', 'Node3D', { instance: 'ExtResource("frame_1")' })],
      externalResources: [makeExtResource('frame_1', 'res://photo_frame.tscn')],
      internalResources: [],
    });

    render(<SceneTreeViewer />, { wrapper: wrap(fake.loader, graph) });

    expect(metadataAtRequest.get('res://photo_frame.tscn')).toBe(true);
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

    fake.scenes.seed('res://sub.tscn', parse(`[node name="SubRoot" type="Node3D"]\n`));

    // The instance node has both inline children and an `instance` ref. The
    // tree shows both groups.
    const graph = createSceneGraphFromTscnScene(
      parse(`[ext_resource type="PackedScene" path="res://sub.tscn" id="sub_1"]

[node name="Inst" instance=ExtResource("sub_1")]

[node name="Override" type="MeshInstance3D" parent="."]
`)
    );

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
    fake.scenes.seed(
      'res://coin/coin.tscn',
      parse(`[node name="Coin" type="Area3D"]

[node name="Circle" type="MeshInstance3D" parent="."]

[node name="Animation" type="AnimationPlayer" parent="."]
`)
    );

    const graph = createSceneGraphFromTscnScene(
      parse(`[ext_resource type="PackedScene" path="res://coin/coin.tscn" id="coin"]

[node name="Coin1" instance=ExtResource("coin")]
`)
    );

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
      ...INSTANTIABLE_SCENE,
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

  it('does NOT collapse an instance of a scene Godot refuses: it lists no row of that scene', () => {
    const fake = createFakeResourceLoader();
    fake.scenes.seed('res://refused.tscn', {
      nodes: [makeNode('RootA', 'Node3D')],
      externalResources: [],
      internalResources: [],
      refusesToInstantiate: true,
    });
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Refusing', 'Node3D', { instance: 'ExtResource("refused")' })],
      externalResources: [makeExtResource('refused', 'res://refused.tscn')],
      internalResources: [],
    });

    const { container } = render(<SceneTreeViewer />, { wrapper: wrap(fake.loader, graph) });

    // The row keeps its own Node3D type: there is no root of the scene to adopt.
    const row = screen.getByText('Refusing').closest('[data-node-path]') as HTMLElement;
    expect(within(row).getByTitle('Node3D')).toBeTruthy();
    expect(container.querySelector('[data-node-path="Refusing/RootA"]')).toBeNull();
  });

  it('search reaches a node inside an instanced sub-scene, keeping the instance row visible', () => {
    const fake = createFakeResourceLoader();
    fake.scenes.seed(
      'res://frame.tscn',
      parse(`[node name="FrameRoot" type="Node3D"]

[node name="SpecialMesh" type="MeshInstance3D" parent="."]
`)
    );
    const graph = createSceneGraphFromTscnScene(
      parse(`[ext_resource type="PackedScene" path="res://frame.tscn" id="f"]

[node name="Main" type="Node3D"]

[node name="Frame" parent="." instance=ExtResource("f")]

[node name="Other" type="Node3D" parent="."]

[editable path="Frame"]
`)
    );

    render(<SceneTreeViewer />, { wrapper: wrap(fake.loader, graph) });

    // Expand the instance so its sub-scene rows render.
    expandRow('Main');
    expandRow('Frame');
    expect(screen.getByText('SpecialMesh')).toBeTruthy();

    // The search walks the live tree: it keeps the instance row, an ancestor of
    // the match, and hides only the unrelated sibling.
    act(() => fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'special' } }));
    expect(screen.getByText('Frame')).toBeTruthy();
    expect(screen.getByText('SpecialMesh')).toBeTruthy();
    expect(screen.queryByText('Other')).toBeNull();
  });
});
