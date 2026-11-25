/**
 * Roving tabIndex per the WAI-ARIA APG Tree View pattern: one treeitem is the
 * tab stop, the selected row or else the first root row. Arrow keys move focus
 * and selection together, since the app has no focused-but-unselected state.
 */
import { describe, expect, it } from 'vitest';
import { act, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useSelectedNodePath, useSelection } from '../../contexts/SelectionContext';
import { renderSceneTree } from './sceneTree.testkit';

/** A scene of `names` below one root, as Node3D, nested where `nested` is true. */
function sceneOf(names: readonly string[], nested = false): string {
  const [root, ...rest] = names;
  const headings = rest.map((name, index) => {
    const parent = nested ? (index === 0 ? '.' : rest.slice(0, index).join('/')) : '.';
    return `[node name="${name}" type="Node3D" parent="${parent}"]`;
  });
  return [`[gd_scene format=3]`, `[node name="${root}" type="Node3D"]`, ...headings].join('\n\n') + '\n';
}

const SIBLINGS = sceneOf(['Root', 'Alpha', 'Bravo']);
const PARENT = sceneOf(['Root', 'Child']);

/** The tree of a scene with its root row expanded, so the siblings below it render. */
async function renderExpanded(source: string, beside?: ReactNode) {
  await renderSceneTree(source, { beside });
  act(() => {
    rowFor('Root').focus();
    fireEvent.keyDown(rowFor('Root'), { key: 'ArrowRight' });
  });
}

/** Every rendered row, in DOM order, which is the visible order. */
function treeItems(): HTMLElement[] {
  return screen.getAllByRole('treeitem');
}

function rowFor(name: string): HTMLElement {
  return screen.getByText(name).closest('[role="treeitem"]') as HTMLElement;
}

describe('<SceneTreeViewer> keyboard operability (#224)', () => {
  it('gives the root row tabIndex=0 and every other row -1 when nothing is selected', async () => {
    await renderSceneTree(SIBLINGS);
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));

    expect(rowFor('Root').tabIndex).toBe(0);
    expect(rowFor('Alpha').tabIndex).toBe(-1);
    expect(rowFor('Bravo').tabIndex).toBe(-1);
  });

  it('moves the tab stop to the selected row', async () => {
    await renderExpanded(SIBLINGS);

    fireEvent.click(rowFor('Bravo'));

    expect(rowFor('Bravo').tabIndex).toBe(0);
    expect(rowFor('Root').tabIndex).toBe(-1);
  });

  it('ArrowDown moves focus + selection to the next sibling row', async () => {
    let selectedNodePath: string | null = null;
    function Observer() {
      selectedNodePath = useSelectedNodePath();
      return null;
    }
    await renderExpanded(SIBLINGS, <Observer />);

    rowFor('Alpha').focus();
    fireEvent.keyDown(rowFor('Alpha'), { key: 'ArrowDown' });

    expect(selectedNodePath).toBe('Root/Bravo');
    expect(globalThis.document.activeElement).toBe(rowFor('Bravo'));
  });

  it('ArrowUp moves focus + selection to the previous sibling row', async () => {
    await renderExpanded(SIBLINGS);

    rowFor('Bravo').focus();
    fireEvent.keyDown(rowFor('Bravo'), { key: 'ArrowUp' });

    expect(globalThis.document.activeElement).toBe(rowFor('Alpha'));
  });

  it('ArrowDown does nothing past the last row', async () => {
    await renderSceneTree(sceneOf(['Only']));

    rowFor('Only').focus();
    expect(() => fireEvent.keyDown(rowFor('Only'), { key: 'ArrowDown' })).not.toThrow();
    expect(globalThis.document.activeElement).toBe(rowFor('Only'));
  });

  it('ArrowRight on a collapsed parent expands it without moving focus', async () => {
    await renderSceneTree(PARENT);

    expect(screen.queryByText('Child')).toBeNull();
    rowFor('Root').focus();
    fireEvent.keyDown(rowFor('Root'), { key: 'ArrowRight' });

    expect(screen.getByText('Child')).toBeTruthy();
    expect(globalThis.document.activeElement).toBe(rowFor('Root'));
  });

  it('ArrowRight on an EXPANDED parent moves focus to its first child', async () => {
    await renderSceneTree(PARENT);

    rowFor('Root').focus();
    fireEvent.keyDown(rowFor('Root'), { key: 'ArrowRight' }); // expand
    fireEvent.keyDown(rowFor('Root'), { key: 'ArrowRight' }); // move to child

    expect(globalThis.document.activeElement).toBe(rowFor('Child'));
  });

  it('ArrowLeft on an expanded parent collapses it without moving focus', async () => {
    await renderSceneTree(PARENT);

    rowFor('Root').focus();
    fireEvent.keyDown(rowFor('Root'), { key: 'ArrowRight' }); // expand
    expect(screen.getByText('Child')).toBeTruthy();

    fireEvent.keyDown(rowFor('Root'), { key: 'ArrowLeft' }); // collapse
    expect(screen.queryByText('Child')).toBeNull();
    expect(globalThis.document.activeElement).toBe(rowFor('Root'));
  });

  it('ArrowLeft on a leaf/collapsed row moves focus to its parent', async () => {
    await renderSceneTree(PARENT);

    rowFor('Root').focus();
    fireEvent.keyDown(rowFor('Root'), { key: 'ArrowRight' }); // expand
    rowFor('Child').focus();
    fireEvent.keyDown(rowFor('Child'), { key: 'ArrowLeft' }); // Child has no children, so focus goes to the parent.

    expect(globalThis.document.activeElement).toBe(rowFor('Root'));
  });

  it('Home focuses the first row and End focuses the last row', async () => {
    await renderExpanded(sceneOf(['Root', 'Alpha', 'Bravo', 'Charlie']));

    rowFor('Bravo').focus();
    fireEvent.keyDown(rowFor('Bravo'), { key: 'End' });
    expect(globalThis.document.activeElement).toBe(rowFor('Charlie'));

    fireEvent.keyDown(rowFor('Charlie'), { key: 'Home' });
    expect(globalThis.document.activeElement).toBe(rowFor('Root'));
  });

  it('keeps a tab stop on the first root row when the SELECTED row is collapsed out of view', async () => {
    // A selection whose row is unmounted must not leave the tree without a tab stop.
    await renderSceneTree(PARENT);

    rowFor('Root').focus();
    fireEvent.keyDown(rowFor('Root'), { key: 'ArrowRight' }); // expand
    fireEvent.click(rowFor('Child')); // select the child
    expect(rowFor('Child').tabIndex).toBe(0);

    fireEvent.keyDown(rowFor('Root'), { key: 'ArrowLeft' }); // collapse: Child unmounts
    expect(screen.queryByText('Child')).toBeNull();
    // The tree must still have exactly one tab stop: the first root row.
    expect(rowFor('Root').tabIndex).toBe(0);
  });

  it('keeps the tab stop on the root row while the selected node has no row', async () => {
    let select: (path: string) => void = () => undefined;
    function Selector() {
      select = useSelection().setSelectedNodePath;
      return null;
    }
    await renderSceneTree(PARENT, { beside: <Selector /> });
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));

    act(() => select('Root/Child/Unlisted'));

    expect(rowFor('Root').tabIndex).toBe(0);
  });

  it('all treeitems stay reachable in one flat DOM query regardless of nesting depth', async () => {
    await renderSceneTree(sceneOf(['A', 'B', 'C'], true));

    rowFor('A').focus();
    fireEvent.keyDown(rowFor('A'), { key: 'ArrowRight' }); // expand A
    fireEvent.keyDown(rowFor('A'), { key: 'ArrowRight' }); // focus B
    fireEvent.keyDown(rowFor('B'), { key: 'ArrowRight' }); // expand B
    fireEvent.keyDown(rowFor('B'), { key: 'ArrowRight' }); // focus C

    expect(globalThis.document.activeElement).toBe(rowFor('C'));
    expect(treeItems()).toHaveLength(3);
  });
});
