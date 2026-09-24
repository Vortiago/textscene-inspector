/**
 * Roving tabIndex per the WAI-ARIA APG Tree View pattern: one treeitem is the
 * tab stop, the selected row or else the first root row. Arrow keys move focus
 * and selection together, since the app has no focused-but-unselected state.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SceneTreeViewer } from './SceneTreeViewer';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider, useSelection } from '../../contexts/SelectionContext';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph';
import type { TscnNode } from '../../../parser/types';

function makeNode(name: string, type: string, children: TscnNode[] = []): TscnNode {
  return { name, type, children, properties: {} };
}

function withPanel(graph: ReturnType<typeof createSceneGraphFromTscnScene>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>{children}</SelectionProvider>
      </HierarchyProvider>
    );
  };
}

/** Every rendered row, in DOM order, which is the visible order. */
function treeItems(): HTMLElement[] {
  return screen.getAllByRole('treeitem');
}

function rowFor(name: string): HTMLElement {
  return screen.getByText(name).closest('[role="treeitem"]') as HTMLElement;
}

describe('<SceneTreeViewer> keyboard operability (#224)', () => {
  it('gives the FIRST root row tabIndex=0 and every other row -1 when nothing is selected', () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Alpha', 'Node3D'), makeNode('Bravo', 'Node3D')],
    });
    render(<SceneTreeViewer />, { wrapper: withPanel(graph) });

    expect(rowFor('Alpha').tabIndex).toBe(0);
    expect(rowFor('Bravo').tabIndex).toBe(-1);
  });

  it('moves the tab stop to the selected row', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Alpha', 'Node3D'), makeNode('Bravo', 'Node3D')],
    });
    render(<SceneTreeViewer />, { wrapper: withPanel(graph) });

    fireEvent.click(rowFor('Bravo'));

    expect(rowFor('Bravo').tabIndex).toBe(0);
    expect(rowFor('Alpha').tabIndex).toBe(-1);
  });

  it('ArrowDown moves focus + selection to the next sibling row', () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Alpha', 'Node3D'), makeNode('Bravo', 'Node3D')],
    });

    let selectedNodePath: string | null = null;
    function Observer() {
      selectedNodePath = useSelection().selectedNodePath;
      return null;
    }

    render(
      <>
        <SceneTreeViewer />
        <Observer />
      </>,
      { wrapper: withPanel(graph) }
    );

    rowFor('Alpha').focus();
    fireEvent.keyDown(rowFor('Alpha'), { key: 'ArrowDown' });

    expect(selectedNodePath).toBe('Bravo');
    expect(globalThis.document.activeElement).toBe(rowFor('Bravo'));
  });

  it('ArrowUp moves focus + selection to the previous sibling row', () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Alpha', 'Node3D'), makeNode('Bravo', 'Node3D')],
    });
    render(<SceneTreeViewer />, { wrapper: withPanel(graph) });

    rowFor('Bravo').focus();
    fireEvent.keyDown(rowFor('Bravo'), { key: 'ArrowUp' });

    expect(globalThis.document.activeElement).toBe(rowFor('Alpha'));
  });

  it('ArrowDown does nothing past the last row', () => {
    const graph = createSceneGraphFromTscnScene({ nodes: [makeNode('Only', 'Node3D')] });
    render(<SceneTreeViewer />, { wrapper: withPanel(graph) });

    rowFor('Only').focus();
    expect(() => fireEvent.keyDown(rowFor('Only'), { key: 'ArrowDown' })).not.toThrow();
    expect(globalThis.document.activeElement).toBe(rowFor('Only'));
  });

  it('ArrowRight on a collapsed parent expands it without moving focus', () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Root', 'Node3D', [makeNode('Child', 'MeshInstance3D')])],
    });
    render(<SceneTreeViewer />, { wrapper: withPanel(graph) });

    expect(screen.queryByText('Child')).toBeNull();
    rowFor('Root').focus();
    fireEvent.keyDown(rowFor('Root'), { key: 'ArrowRight' });

    expect(screen.getByText('Child')).toBeTruthy();
    expect(globalThis.document.activeElement).toBe(rowFor('Root'));
  });

  it('ArrowRight on an EXPANDED parent moves focus to its first child', () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Root', 'Node3D', [makeNode('Child', 'MeshInstance3D')])],
    });
    render(<SceneTreeViewer />, { wrapper: withPanel(graph) });

    rowFor('Root').focus();
    fireEvent.keyDown(rowFor('Root'), { key: 'ArrowRight' }); // expand
    fireEvent.keyDown(rowFor('Root'), { key: 'ArrowRight' }); // move to child

    expect(globalThis.document.activeElement).toBe(rowFor('Child'));
  });

  it('ArrowLeft on an expanded parent collapses it without moving focus', () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Root', 'Node3D', [makeNode('Child', 'MeshInstance3D')])],
    });
    render(<SceneTreeViewer />, { wrapper: withPanel(graph) });

    rowFor('Root').focus();
    fireEvent.keyDown(rowFor('Root'), { key: 'ArrowRight' }); // expand
    expect(screen.getByText('Child')).toBeTruthy();

    fireEvent.keyDown(rowFor('Root'), { key: 'ArrowLeft' }); // collapse
    expect(screen.queryByText('Child')).toBeNull();
    expect(globalThis.document.activeElement).toBe(rowFor('Root'));
  });

  it('ArrowLeft on a leaf/collapsed row moves focus to its parent', () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Root', 'Node3D', [makeNode('Child', 'MeshInstance3D')])],
    });
    render(<SceneTreeViewer />, { wrapper: withPanel(graph) });

    rowFor('Root').focus();
    fireEvent.keyDown(rowFor('Root'), { key: 'ArrowRight' }); // expand
    rowFor('Child').focus();
    fireEvent.keyDown(rowFor('Child'), { key: 'ArrowLeft' }); // Child has no children, so focus goes to the parent.

    expect(globalThis.document.activeElement).toBe(rowFor('Root'));
  });

  it('Home focuses the first row and End focuses the last row', () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Alpha', 'Node3D'), makeNode('Bravo', 'Node3D'), makeNode('Charlie', 'Node3D')],
    });
    render(<SceneTreeViewer />, { wrapper: withPanel(graph) });

    rowFor('Bravo').focus();
    fireEvent.keyDown(rowFor('Bravo'), { key: 'End' });
    expect(globalThis.document.activeElement).toBe(rowFor('Charlie'));

    fireEvent.keyDown(rowFor('Charlie'), { key: 'Home' });
    expect(globalThis.document.activeElement).toBe(rowFor('Alpha'));
  });

  it('keeps a tab stop on the first root row when the SELECTED row is collapsed out of view', () => {
    // A selection whose row is unmounted must not leave the tree without a tab stop.
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeNode('Root', 'Node3D', [makeNode('Child', 'MeshInstance3D')])],
    });
    render(<SceneTreeViewer />, { wrapper: withPanel(graph) });

    rowFor('Root').focus();
    fireEvent.keyDown(rowFor('Root'), { key: 'ArrowRight' }); // expand
    fireEvent.click(rowFor('Child')); // select the child
    expect(rowFor('Child').tabIndex).toBe(0);

    fireEvent.keyDown(rowFor('Root'), { key: 'ArrowLeft' }); // collapse: Child unmounts
    expect(screen.queryByText('Child')).toBeNull();
    // The tree must still have exactly one tab stop: the first root row.
    expect(rowFor('Root').tabIndex).toBe(0);
  });

  it('all treeitems stay reachable in one flat DOM query regardless of nesting depth', () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [
        makeNode('A', 'Node3D', [makeNode('B', 'Node3D', [makeNode('C', 'MeshInstance3D')])]),
      ],
    });
    render(<SceneTreeViewer />, { wrapper: withPanel(graph) });

    rowFor('A').focus();
    fireEvent.keyDown(rowFor('A'), { key: 'ArrowRight' }); // expand A
    fireEvent.keyDown(rowFor('A'), { key: 'ArrowRight' }); // focus B
    fireEvent.keyDown(rowFor('B'), { key: 'ArrowRight' }); // expand B
    fireEvent.keyDown(rowFor('B'), { key: 'ArrowRight' }); // focus C

    expect(globalThis.document.activeElement).toBe(rowFor('C'));
    expect(treeItems()).toHaveLength(3);
  });
});
