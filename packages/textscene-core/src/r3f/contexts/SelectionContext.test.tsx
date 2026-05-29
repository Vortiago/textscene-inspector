import { describe, expect, it } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SelectionProvider, useSelection } from './SelectionContext';
import { HierarchyProvider } from './HierarchyContext';

function wrap({ children }: { children: ReactNode }) {
  return (
    <HierarchyProvider value={{ sceneGraph: null, panelId: 'p1' }}>
      <SelectionProvider>{children}</SelectionProvider>
    </HierarchyProvider>
  );
}

describe('SelectionContext', () => {
  it('starts with no selection, no hover, no expanded paths', () => {
    const { result } = renderHook(() => useSelection(), { wrapper: wrap });
    expect(result.current.selectedNodePath).toBeNull();
    expect(result.current.hoveredNodePath).toBeNull();
    expect(result.current.expandedNodePaths.size).toBe(0);
  });

  it('updates selectedNodePath when setSelectedNodePath is called', () => {
    const { result } = renderHook(() => useSelection(), { wrapper: wrap });
    act(() => result.current.setSelectedNodePath('Root/Child'));
    expect(result.current.selectedNodePath).toBe('Root/Child');
  });

  it('toggles expandedNodePaths', () => {
    const { result } = renderHook(() => useSelection(), { wrapper: wrap });
    act(() => result.current.toggleExpandedNodePath('Root'));
    expect(result.current.expandedNodePaths.has('Root')).toBe(true);
    act(() => result.current.toggleExpandedNodePath('Root'));
    expect(result.current.expandedNodePaths.has('Root')).toBe(false);
  });

  it('setExpandedNodePaths replaces the whole set', () => {
    const { result } = renderHook(() => useSelection(), { wrapper: wrap });
    act(() => result.current.setExpandedNodePaths(new Set(['A', 'A/B', 'A/B/C'])));
    expect(result.current.expandedNodePaths.size).toBe(3);
    act(() => result.current.setExpandedNodePaths(new Set()));
    expect(result.current.expandedNodePaths.size).toBe(0);
  });

  it('throws when used outside a SelectionProvider', () => {
    function Bad() {
      useSelection();
      return null;
    }
    expect(() => render(<Bad />)).toThrow(/SelectionProvider/);
  });

  it('isolates selection state between two independent providers', () => {
    let p1Selection: ReturnType<typeof useSelection> | null = null;
    let p2Selection: ReturnType<typeof useSelection> | null = null;

    function CaptureP1() {
      p1Selection = useSelection();
      return null;
    }
    function CaptureP2() {
      p2Selection = useSelection();
      return null;
    }

    render(
      <>
        <HierarchyProvider value={{ sceneGraph: null, panelId: 'p1' }}>
          <SelectionProvider>
            <CaptureP1 />
          </SelectionProvider>
        </HierarchyProvider>
        <HierarchyProvider value={{ sceneGraph: null, panelId: 'p2' }}>
          <SelectionProvider>
            <CaptureP2 />
          </SelectionProvider>
        </HierarchyProvider>
      </>
    );

    expect(p1Selection).not.toBeNull();
    expect(p2Selection).not.toBeNull();

    act(() => p1Selection!.setSelectedNodePath('Node3D/MeshInstance3D'));

    // Panel 2's selection is unchanged.
    expect(p2Selection!.selectedNodePath).toBeNull();
  });
});
