/**
 * Regression test for selection reset on scene change.
 *
 * Pins `SelectionContext.clearAll()`: a single call must reset every
 * selection-derived state slot (selected/hovered paths, expanded set,
 * hidden set) AND empty the `nodeObjectMap` ref-map. Without this,
 * a fixture swap leaves stale selection + a `SelectionHighlight`
 * BoxHelper targeting an unmounted Object3D at the previous fixture's
 * coordinates.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { SelectionProvider, useSelection } from './SelectionContext';

function wrap({ children }: { children: ReactNode }) {
  return <SelectionProvider>{children}</SelectionProvider>;
}

describe('SelectionContext.clearAll (WI-UX-5)', () => {
  it('resets selected/hovered/expanded/hidden and empties the ref-map in one call', () => {
    const { result } = renderHook(() => useSelection(), { wrapper: wrap });
    const fakeObject = new THREE.Object3D();

    act(() => {
      result.current.setSelectedNodePath('Root/Mesh');
      result.current.hoverStore.set('Root/Light');
      result.current.toggleExpandedNodePath('Root');
      result.current.toggleHidden('Root/Mesh');
      result.current.registerNodeObject('Root/Mesh', fakeObject);
    });

    expect(result.current.selectedNodePath).toBe('Root/Mesh');
    expect(result.current.hoverStore.get()).toBe('Root/Light');
    expect(result.current.expandedNodePaths.has('Root')).toBe(true);
    expect(result.current.hiddenNodePaths.has('Root/Mesh')).toBe(true);
    expect(result.current.nodeObjectMap.has('Root/Mesh')).toBe(true);

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.selectedNodePath).toBeNull();
    expect(result.current.hoverStore.get()).toBeNull();
    expect(result.current.expandedNodePaths.size).toBe(0);
    expect(result.current.hiddenNodePaths.size).toBe(0);
    expect(result.current.nodeObjectMap.size).toBe(0);
  });

  it('is idempotent — calling clearAll on an already-empty state does not throw', () => {
    const { result } = renderHook(() => useSelection(), { wrapper: wrap });

    act(() => {
      result.current.clearAll();
      result.current.clearAll();
    });

    expect(result.current.selectedNodePath).toBeNull();
    expect(result.current.hoverStore.get()).toBeNull();
    expect(result.current.expandedNodePaths.size).toBe(0);
    expect(result.current.hiddenNodePaths.size).toBe(0);
    expect(result.current.nodeObjectMap.size).toBe(0);
  });
});
