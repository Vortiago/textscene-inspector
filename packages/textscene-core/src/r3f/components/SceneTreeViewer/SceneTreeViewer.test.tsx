import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SceneTreeViewer } from './SceneTreeViewer';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider, useSelectedNodePath } from '../../contexts/SelectionContext';
import { ExpandedRowsProvider, useExpandedPaths } from '../TscnPreviewShell/expandedRows';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';
import { openTreeScene, renderSceneTree, rowAt } from './sceneTree.testkit';

const ROOT_WITH_MESH = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="ChildMesh" type="MeshInstance3D" parent="."]
`;

const NESTED = `[gd_scene format=3]

[node name="A" type="Node3D"]

[node name="B" type="Node3D" parent="."]

[node name="C" type="MeshInstance3D" parent="B"]
`;

const SIBLINGS = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Alpha" type="Node3D" parent="."]

[node name="Bravo" type="Node3D" parent="."]
`;

const MYSTERY = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Mystery" type="TotallyUnknownType" parent="."]
`;

describe('<SceneTreeViewer>', () => {
  it('renders empty-state copy for a graph with no node', async () => {
    const scene = openTreeScene('[gd_scene format=3]\n');
    const sceneGraph = createSceneGraphFromTscnScene({ nodes: [] });
    render(
      <HierarchyProvider value={{ sceneGraph, panelId: 'p', scene }}>
        <SelectionProvider>
          <ExpandedRowsProvider>
            <SceneTreeViewer />
          </ExpandedRowsProvider>
        </SelectionProvider>
      </HierarchyProvider>
    );
    expect(await screen.findByText('No nodes to display')).toBeTruthy();
  });

  it('renders a passive loading state when sceneGraph is null', () => {
    render(
      <HierarchyProvider value={{ sceneGraph: null, panelId: 'p' }}>
        <SelectionProvider>
          <ExpandedRowsProvider>
            <SceneTreeViewer />
          </ExpandedRowsProvider>
        </SelectionProvider>
      </HierarchyProvider>
    );
    expect(screen.getByText(/Loading scene/i)).toBeTruthy();
  });

  it('renders the root node name', async () => {
    await renderSceneTree(ROOT_WITH_MESH);
    expect(screen.getByText('Root')).toBeTruthy();
  });

  it("badges a row with the node's class", async () => {
    await renderSceneTree(ROOT_WITH_MESH);
    expect(within(rowAt('Root')!).getByTitle('Node3D').textContent).toBe('N3D');
  });

  it('clicking a row sets selectedNodePath in SelectionContext', async () => {
    let observed: string | null = 'sentinel';
    function Observer() {
      observed = useSelectedNodePath();
      return null;
    }
    await renderSceneTree(ROOT_WITH_MESH, { beside: <Observer /> });

    await userEvent.click(screen.getByText('Root'));
    expect(observed).toBe('Root');
  });

  it('expand button reveals children', async () => {
    await renderSceneTree(ROOT_WITH_MESH);
    expect(screen.queryByText('ChildMesh')).toBeNull();

    // The row's toggle is labelled "Expand", not "Expand all".
    await userEvent.click(screen.getByRole('button', { name: 'Expand' }));
    expect(screen.getByText('ChildMesh')).toBeTruthy();
  });

  it('fires onNodeReveal on double click with the live path and the name', async () => {
    const onNodeReveal = vi.fn();
    await renderSceneTree(ROOT_WITH_MESH, { onNodeReveal });

    await userEvent.dblClick(screen.getByText('Root'));
    expect(onNodeReveal).toHaveBeenCalledWith('Root', 'Root');
  });

  it('expand-all / collapse-all toolbar buttons drive the expanded rows', async () => {
    let captured: ReadonlySet<string> | null = null;
    function Observer() {
      captured = useExpandedPaths();
      return null;
    }
    await renderSceneTree(NESTED, { beside: <Observer /> });

    await userEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(captured!.has('A')).toBe(true);
    expect(captured!.has('A/B')).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(captured!.size).toBe(0);
  });

  it('search filter hides non-matching rows and reports no-match copy', async () => {
    await renderSceneTree(SIBLINGS);
    await userEvent.click(screen.getByRole('button', { name: 'Expand all' }));

    await userEvent.type(screen.getByRole('searchbox'), 'alph');
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.queryByText('Bravo')).toBeNull();

    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText(/No nodes match/)).toBeTruthy();
  });

  it('flags a node the view reports with no component as "Not Implemented"', async () => {
    const undrawn = [
      { path: '/root/Root/Mystery', meshTypes: [], isEmptyShape: false, hasNoComponent: true },
    ];
    await renderSceneTree(MYSTERY, { undrawn });
    await userEvent.click(screen.getByRole('button', { name: 'Expand' }));

    expect(within(rowAt('Root/Mystery')!).getByText('Not Implemented')).toBeTruthy();
  });

  it('flags nothing while the view reports no missing component', async () => {
    await renderSceneTree(MYSTERY);
    await userEvent.click(screen.getByRole('button', { name: 'Expand' }));

    expect(within(rowAt('Root/Mystery')!).queryByText('Not Implemented')).toBeNull();
  });

  it('words the "Not Implemented" badge tooltip as not yet supported', async () => {
    const undrawn = [
      { path: '/root/Root/Mystery', meshTypes: [], isEmptyShape: false, hasNoComponent: true },
    ];
    await renderSceneTree(MYSTERY, { undrawn });
    await userEvent.click(screen.getByRole('button', { name: 'Expand' }));

    expect(within(rowAt('Root/Mystery')!).getByText('Not Implemented').getAttribute('title')).toBe(
      'TotallyUnknownType is not yet supported by the renderer'
    );
  });
});
