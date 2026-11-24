import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { SelectionProvider, useSelectedNodePath, useSelection } from './SelectionContext';

function wrap({ children }: { children: ReactNode }) {
  return <SelectionProvider>{children}</SelectionProvider>;
}

function useSelectionAndPath() {
  return { selection: useSelection(), selectedNodePath: useSelectedNodePath() };
}

describe('SelectionContext.clearAll (WI-UX-5)', () => {
  it('clears the outlined path and empties the ref-map in one call', () => {
    const { result } = renderHook(useSelectionAndPath, { wrapper: wrap });
    const fakeObject = new THREE.Object3D();

    act(() => {
      result.current.selection.setSelectedNodePath('Root/Mesh');
      result.current.selection.registerNodeObject('Root/Mesh', fakeObject);
    });

    expect(result.current.selectedNodePath).toBe('Root/Mesh');
    expect(result.current.selection.nodeObjectMap.has('Root/Mesh')).toBe(true);

    act(() => {
      result.current.selection.clearAll();
    });

    expect(result.current.selectedNodePath).toBeNull();
    expect(result.current.selection.nodeObjectMap.size).toBe(0);
  });

  it('clears an already empty state without a throw', () => {
    const { result } = renderHook(useSelectionAndPath, { wrapper: wrap });

    act(() => {
      result.current.selection.clearAll();
      result.current.selection.clearAll();
    });

    expect(result.current.selectedNodePath).toBeNull();
    expect(result.current.selection.nodeObjectMap.size).toBe(0);
  });
});
