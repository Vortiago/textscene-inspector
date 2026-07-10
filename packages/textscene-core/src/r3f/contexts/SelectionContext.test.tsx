import { describe, expect, it } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SelectionProvider, useHoveredNodePath, useSelection } from './SelectionContext';
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
    expect(result.current.hoverStore.get()).toBeNull();
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

  it('isolates hoverStore between two independent providers', () => {
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

    act(() => p1Selection!.hoverStore.set('Node3D/MeshInstance3D'));

    expect(p1Selection!.hoverStore.get()).toBe('Node3D/MeshInstance3D');
    expect(p2Selection!.hoverStore.get()).toBeNull();
  });
});

describe('SelectionContext — hover (WI-213: ref-based external store)', () => {
  it('hoverStore.get() reflects the last set() value', () => {
    const { result } = renderHook(() => useSelection(), { wrapper: wrap });
    act(() => result.current.hoverStore.set('Root/Cube'));
    expect(result.current.hoverStore.get()).toBe('Root/Cube');
    act(() => result.current.hoverStore.set(null));
    expect(result.current.hoverStore.get()).toBeNull();
  });

  it('hoverStore keeps a stable identity across unrelated re-renders of the provider', () => {
    const { result, rerender } = renderHook(() => useSelection(), { wrapper: wrap });
    const store = result.current.hoverStore;
    act(() => result.current.setSelectedNodePath('Root'));
    rerender();
    expect(result.current.hoverStore).toBe(store);
  });

  it('useHoveredNodePath() re-renders when the store changes', () => {
    const { result } = renderHook(
      () => ({ selection: useSelection(), hovered: useHoveredNodePath() }),
      { wrapper: wrap }
    );
    expect(result.current.hovered).toBeNull();
    act(() => result.current.selection.hoverStore.set('Root/Cube'));
    expect(result.current.hovered).toBe('Root/Cube');
  });

  it('PERF: a useSelection() consumer does NOT re-render when only hover changes', () => {
    let renderCount = 0;
    let selectionRef: ReturnType<typeof useSelection> | null = null;

    function Consumer() {
      selectionRef = useSelection();
      renderCount++;
      return null;
    }

    render(
      <HierarchyProvider value={{ sceneGraph: null, panelId: 'p1' }}>
        <SelectionProvider>
          <Consumer />
        </SelectionProvider>
      </HierarchyProvider>
    );

    const countAfterMount = renderCount;
    act(() => selectionRef!.hoverStore.set('Root/Cube'));
    act(() => selectionRef!.hoverStore.set('Root/OtherCube'));
    act(() => selectionRef!.hoverStore.set(null));

    expect(renderCount).toBe(countAfterMount);
  });
});
