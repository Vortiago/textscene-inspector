import { describe, expect, it } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { SelectionProvider, useSelectedNodePath, useSelection } from './SelectionContext';
import { HierarchyProvider } from './HierarchyContext';

function wrap({ children }: { children: ReactNode }) {
  return (
    <HierarchyProvider value={{ sceneGraph: null, panelId: 'p1' }}>
      <SelectionProvider>{children}</SelectionProvider>
    </HierarchyProvider>
  );
}

describe('SelectionContext', () => {
  it('starts with no selection', () => {
    const { result } = renderHook(() => useSelectedNodePath(), { wrapper: wrap });
    expect(result.current).toBeNull();
  });

  it('updates the selected path when setSelectedNodePath is called', () => {
    const { result } = renderHook(() => ({ selection: useSelection(), selected: useSelectedNodePath() }), {
      wrapper: wrap,
    });
    act(() => result.current.selection.setSelectedNodePath('Root/Child'));
    expect(result.current.selected).toBe('Root/Child');
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
    let p2Selected: string | null = 'unread';

    function CaptureP1() {
      p1Selection = useSelection();
      return null;
    }
    function CaptureP2() {
      p2Selected = useSelectedNodePath();
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

    act(() => p1Selection!.setSelectedNodePath('Node3D/MeshInstance3D'));

    expect(p2Selected).toBeNull();
  });

  // The previewer hands the view each hovered tree row as its selection.
  it('re-renders no useSelection() consumer when only the selected path changes', () => {
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
    act(() => selectionRef!.setSelectedNodePath('Root/Cube'));
    act(() => selectionRef!.setSelectedNodePath('Root/OtherCube'));
    act(() => selectionRef!.setSelectedNodePath(null));

    expect(renderCount).toBe(countAfterMount);
  });
});

describe('SelectionContext — objectPathMap (WI-213: event-delegated picking)', () => {
  it('registerNodeObject populates both the forward and reverse maps', () => {
    const { result } = renderHook(() => useSelection(), { wrapper: wrap });
    const object = new THREE.Object3D();
    act(() => result.current.registerNodeObject('Root/Cube', object));

    expect(result.current.nodeObjectMap.get('Root/Cube')).toBe(object);
    expect(result.current.objectPathMap.get(object)).toBe('Root/Cube');
  });

  it('unregisterNodeObject removes the object from the reverse map too', () => {
    const { result } = renderHook(() => useSelection(), { wrapper: wrap });
    const object = new THREE.Object3D();
    act(() => result.current.registerNodeObject('Root/Cube', object));
    act(() => result.current.unregisterNodeObject('Root/Cube'));

    expect(result.current.nodeObjectMap.has('Root/Cube')).toBe(false);
    expect(result.current.objectPathMap.get(object)).toBeUndefined();
  });

  it('re-registering a path with a NEW object does not leave the old object resolvable', () => {
    const { result } = renderHook(() => useSelection(), { wrapper: wrap });
    const first = new THREE.Object3D();
    const second = new THREE.Object3D();
    act(() => result.current.registerNodeObject('Root/Cube', first));
    act(() => result.current.registerNodeObject('Root/Cube', second));

    expect(result.current.objectPathMap.get(second)).toBe('Root/Cube');
    expect(result.current.objectPathMap.get(first)).toBeUndefined();
  });
});
