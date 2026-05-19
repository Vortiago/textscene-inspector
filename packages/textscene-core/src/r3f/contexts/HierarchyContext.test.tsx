import { describe, expect, it } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { HierarchyProvider, useHierarchy } from './HierarchyContext';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph';

describe('HierarchyContext', () => {
  it('exposes the provided sceneGraph and panelId', () => {
    const graph = createSceneGraphFromTscnScene({ nodes: [] });
    const { result } = renderHook(() => useHierarchy(), {
      wrapper: ({ children }) => (
        <HierarchyProvider value={{ sceneGraph: graph, panelId: 'panel-a' }}>
          {children}
        </HierarchyProvider>
      ),
    });
    expect(result.current.sceneGraph).toBe(graph);
    expect(result.current.panelId).toBe('panel-a');
  });

  it('allows sceneGraph to be null (loading state)', () => {
    const { result } = renderHook(() => useHierarchy(), {
      wrapper: ({ children }) => (
        <HierarchyProvider value={{ sceneGraph: null, panelId: 'p' }}>
          {children}
        </HierarchyProvider>
      ),
    });
    expect(result.current.sceneGraph).toBeNull();
  });

  it('throws when used outside a HierarchyProvider', () => {
    function Bad() {
      useHierarchy();
      return null;
    }
    expect(() => render(<Bad />)).toThrow(/HierarchyProvider/);
  });
});
