/**
 * The 2D Control overlay must honor `SelectionContext.hiddenNodePaths` — the
 * same per-path hide the scene-tree eye toggle drives for the 3D viewport via
 * NodeDispatcher. Hiding a Control node removes it (and its whole subtree) from
 * the overlay; non-hidden siblings stay. Paths use the same scheme as the tree:
 * root = node name, child = `parent/child`.
 */
import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import type { TscnNode } from '../../parser/types';
import { ControlOverlay } from './index';
import {
  SelectionProvider,
  useSelection,
  type SelectionContextValue,
} from '../contexts/SelectionContext';

function node(
  name: string,
  type: string,
  children: TscnNode[] = [],
  properties: object = {}
): TscnNode {
  return { name, type, children, properties: { name, ...properties } } as TscnNode;
}

const find = (c: HTMLElement, type: string): HTMLElement | null =>
  c.querySelector(`[data-control-type="${type}"]`);

describe('ControlOverlay — hidden nodes (scene-tree eye toggle)', () => {
  it('removes a node and its subtree when its path is in hiddenNodePaths', () => {
    const root = node('Root', 'Control', [
      node('Box', 'VBoxContainer', [node('Hi', 'Label', [], { text: 'Hi' })]),
    ]);

    let selection!: SelectionContextValue;
    function Capture() {
      selection = useSelection();
      return null;
    }

    const { container } = render(
      <SelectionProvider>
        <Capture />
        <ControlOverlay nodes={[root]} />
      </SelectionProvider>
    );

    // Baseline: the whole subtree renders.
    expect(find(container, 'Control')).not.toBeNull();
    expect(find(container, 'VBoxContainer')).not.toBeNull();
    expect(find(container, 'Label')).not.toBeNull();

    // Hide "Root/Box" via the same API the tree's eye toggle calls.
    act(() => selection.toggleHidden('Root/Box'));

    // The hidden node and its descendants are gone; the root stays.
    expect(find(container, 'Control')).not.toBeNull();
    expect(find(container, 'VBoxContainer')).toBeNull();
    expect(find(container, 'Label')).toBeNull();
  });

  it('GridContainer EXPAND column ignores a hidden child (no auto-place drift)', () => {
    // 2 cols: [A, B(EXPAND)]. B is the EXPAND item in column 1. Hiding A removes
    // its cell, so B auto-places into column 0 → the stretch column must follow.
    const grid = node('Grid', 'GridContainer', [
      node('A', 'Label', [], { sizeFlagsHorizontal: 1 }),
      node('B', 'Label', [], { sizeFlagsHorizontal: 3 }),
    ], { columns: 2 });

    let selection!: SelectionContextValue;
    function Capture() {
      selection = useSelection();
      return null;
    }
    const { container } = render(
      <SelectionProvider>
        <Capture />
        <ControlOverlay nodes={[grid]} />
      </SelectionProvider>
    );

    const style = () => (find(container, 'GridContainer') as HTMLElement).style.gridTemplateColumns;
    expect(style()).toBe('max-content 1fr'); // A in col0, B(EXPAND) in col1

    act(() => selection.toggleHidden('Grid/A'));
    // B now auto-places into column 0, so the stretch column moves there too.
    // (Before the fix the template was computed over the hidden child and stayed
    // 'max-content 1fr', stretching the wrong column.)
    expect(style()).toBe('1fr max-content');
  });
});
