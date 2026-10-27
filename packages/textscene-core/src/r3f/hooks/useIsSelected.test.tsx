import { describe, expect, it } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { SelectionProvider, useSelection } from '../contexts/SelectionContext';
import { NodePathProvider } from '../contexts/NodePathContext';
import { GizmoScene } from '../testing/GizmoScene';
import { useIsSelected } from './useIsSelected';

function isSelectedIn(nodePath: string | null, selectedPath: string | null): boolean {
  return renderHook(() => useIsSelected(), {
    wrapper: ({ children }) => (
      <GizmoScene nodePath={nodePath} selectedPath={selectedPath}>
        {children}
      </GizmoScene>
    ),
  }).result.current;
}

describe('useIsSelected', () => {
  it('is true for the node the tree selects', () => {
    expect(isSelectedIn('Root/Lamp', 'Root/Lamp')).toBe(true);
  });

  it.each([
    ['nothing is selected', 'Root/Lamp', null],
    ['another node is selected', 'Root/Lamp', 'Root/Other'],
    ['no node owns the hook', null, 'Root/Lamp'],
  ])('is false when %s', (_label, nodePath, selectedPath) => {
    expect(isSelectedIn(nodePath, selectedPath)).toBe(false);
  });

  it('is false outside a selection provider', () => {
    expect(renderHook(() => useIsSelected()).result.current).toBe(false);
  });

  it('does not re-render when the tree expands a node, which is no selection change', () => {
    let renders = 0;
    let toggleExpanded: (path: string) => void = () => {};
    function Subject() {
      renders++;
      useIsSelected();
      return null;
    }
    function Probe() {
      toggleExpanded = useSelection().toggleExpandedNodePath;
      return null;
    }
    render(
      <SelectionProvider>
        <NodePathProvider path="Root/Lamp">
          <Subject />
        </NodePathProvider>
        <Probe />
      </SelectionProvider>
    );
    const before = renders;
    act(() => toggleExpanded('Root'));
    expect(renders).toBe(before);
  });

  it('re-renders the node that gains the selection and the one that loses it, and no other', () => {
    const renders: Record<string, number> = { A: 0, B: 0, C: 0 };
    let select: (path: string | null) => void = () => {};
    function Subject({ name }: { name: string }) {
      renders[name]!++;
      useIsSelected();
      return null;
    }
    function Probe() {
      select = useSelection().setSelectedNodePath;
      return null;
    }
    render(
      <SelectionProvider>
        {['A', 'B', 'C'].map((name) => (
          <NodePathProvider key={name} path={name}>
            <Subject name={name} />
          </NodePathProvider>
        ))}
        <Probe />
      </SelectionProvider>
    );
    act(() => select('A'));
    const afterFirst = { ...renders };
    act(() => select('B'));
    expect({
      A: renders.A! - afterFirst.A!,
      B: renders.B! - afterFirst.B!,
      C: renders.C! - afterFirst.C!,
    }).toEqual({
      A: 1,
      B: 1,
      C: 0,
    });
  });
});
