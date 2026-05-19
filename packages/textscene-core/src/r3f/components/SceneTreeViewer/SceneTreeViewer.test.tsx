import { describe, expect, it, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SceneTreeViewer } from './SceneTreeViewer';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider, useSelection } from '../../contexts/SelectionContext';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph';
import type { TscnNode } from '../../../parser/types';

function makeNode(name: string, type: string, children: TscnNode[] = []): TscnNode {
  return { name, type, children, properties: {} };
}

function withPanel(graph = createSceneGraphFromTscnScene({ nodes: [] })) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>{children}</SelectionProvider>
      </HierarchyProvider>
    );
  };
}

describe('<SceneTreeViewer>', () => {
  it('renders empty-state copy when there are no nodes', () => {
    render(<SceneTreeViewer />, { wrapper: withPanel() });
    expect(screen.getByText('No nodes to display')).toBeTruthy();
  });

  it('renders a passive loading state when sceneGraph is null', () => {
    function NullPanel({ children }: { children: ReactNode }) {
      return (
        <HierarchyProvider value={{ sceneGraph: null, panelId: 'p' }}>
          <SelectionProvider>{children}</SelectionProvider>
        </HierarchyProvider>
      );
    }
    render(<SceneTreeViewer />, { wrapper: NullPanel });
    expect(screen.getByText(/Loading scene/i)).toBeTruthy();
  });

  it('renders the root node names', () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [
        makeNode('Root', 'Node3D', [makeNode('Mesh', 'MeshInstance3D')]),
      ],
    });
    render(<SceneTreeViewer />, { wrapper: withPanel(graph) });
    expect(screen.getByText('Root')).toBeTruthy();
  });

  it('clicking a row sets selectedNodePath in SelectionContext', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Root', 'Node3D')],
    });

    let observed: string | null = 'sentinel';
    function Observer() {
      observed = useSelection().selectedNodePath;
      return null;
    }

    render(
      <>
        <SceneTreeViewer />
        <Observer />
      </>,
      { wrapper: withPanel(graph) }
    );

    await userEvent.click(screen.getByText('Root'));
    expect(observed).toBe('Root');
  });

  it('expand button reveals children', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [
        makeNode('Root', 'Node3D', [makeNode('ChildMesh', 'MeshInstance3D')]),
      ],
    });
    render(<SceneTreeViewer />, { wrapper: withPanel(graph) });

    // Child not visible until expanded.
    expect(screen.queryByText('ChildMesh')).toBeNull();

    // The row's expand toggle is labeled "Expand" (not "Expand all").
    await userEvent.click(screen.getByRole('button', { name: 'Expand', exact: true }));
    expect(screen.getByText('ChildMesh')).toBeTruthy();
  });

  it('fires onNodeReveal on double click with the path and node', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Root', 'Node3D')],
    });
    const onNodeReveal = vi.fn();
    render(<SceneTreeViewer onNodeReveal={onNodeReveal} />, { wrapper: withPanel(graph) });

    await userEvent.dblClick(screen.getByText('Root'));
    expect(onNodeReveal).toHaveBeenCalledWith('Root', expect.objectContaining({ name: 'Root' }));
  });

  it('expand-all / collapse-all toolbar buttons drive SelectionContext.expandedNodePaths', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [
        makeNode('A', 'Node3D', [
          makeNode('B', 'Node3D', [makeNode('C', 'MeshInstance3D')]),
        ]),
      ],
    });

    let captured: ReadonlySet<string> | null = null;
    function Observer() {
      captured = useSelection().expandedNodePaths;
      return null;
    }

    render(
      <>
        <SceneTreeViewer />
        <Observer />
      </>,
      { wrapper: withPanel(graph) }
    );

    await userEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(captured!.has('A')).toBe(true);
    expect(captured!.has('A/B')).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(captured!.size).toBe(0);
  });

  it('search filter hides non-matching root nodes and reports no-match copy', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Alpha', 'Node3D'), makeNode('Bravo', 'Node3D')],
    });
    render(<SceneTreeViewer />, { wrapper: withPanel(graph) });

    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Bravo')).toBeTruthy();

    await userEvent.type(screen.getByRole('searchbox'), 'alph');
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.queryByText('Bravo')).toBeNull();

    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText(/No nodes match/)).toBeTruthy();
  });

  it('flags unregistered node types as "Not Implemented"', () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Mystery', 'TotallyUnknownType')],
    });
    render(<SceneTreeViewer />, { wrapper: withPanel(graph) });

    // Both the row and the badge should be present.
    const row = screen.getByText('Mystery').closest('[data-node-path]') as HTMLElement;
    expect(row).toBeTruthy();
    expect(within(row).getByText('Not Implemented')).toBeTruthy();
  });

  it('visibility toggle button is rendered with eye/hidden semantics', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Root', 'Node3D')],
    });
    render(<SceneTreeViewer />, { wrapper: withPanel(graph) });

    const toggle = screen.getByRole('button', { name: /hide node/i });
    expect(toggle).toBeTruthy();
    await act(async () => {
      await userEvent.click(toggle);
    });
    expect(screen.getByRole('button', { name: /show node/i })).toBeTruthy();
  });
});
