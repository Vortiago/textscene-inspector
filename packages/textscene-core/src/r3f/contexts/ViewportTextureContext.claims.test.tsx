/**
 * The `%Name` claim table is built once per scene tree and shared by every hook
 * over it, since every Sprite2D and MeshInstance3D asks on each re-parse.
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph.js';
import type { TscnNode } from '../../parser/types.js';
import { HierarchyProvider } from './HierarchyContext.js';
import { useUniqueNameClaims, useUniqueNamePaths } from './ViewportTextureContext.js';

function node(name: string, flagged = false, children: TscnNode[] = []): TscnNode {
  return {
    name,
    type: 'Node2D',
    properties: {},
    rawProperties: flagged ? { unique_name_in_owner: 'true' } : {},
    children,
  };
}

const graph = createSceneGraphFromTscnScene({
  nodes: [node('Root', false, [node('Hud', true)])],
});

function wrapper({ children }: { children: ReactNode }) {
  return <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>{children}</HierarchyProvider>;
}

describe('useUniqueNameClaims', () => {
  it('hands two hook instances over one scene the same table object', () => {
    const a = renderHook(() => useUniqueNameClaims(), { wrapper });
    const b = renderHook(() => useUniqueNameClaims(), { wrapper });
    expect(a.result.current).toBeDefined();
    expect(a.result.current!.has('%Hud')).toBe(true);
    expect(b.result.current).toBe(a.result.current);
  });

  it('is undefined outside a hierarchy', () => {
    const { result } = renderHook(() => useUniqueNameClaims());
    expect(result.current).toBeUndefined();
  });
});

describe('useUniqueNamePaths', () => {
  function graphWithHud(): ReturnType<typeof createSceneGraphFromTscnScene> {
    return createSceneGraphFromTscnScene({ nodes: [node('Root', false, [node('Hud', true)])] });
  }

  /** Renders the hook over a scene graph the returned `setGraph` swaps before a rerender. */
  function renderPaths(initial: ReturnType<typeof createSceneGraphFromTscnScene>) {
    let sceneGraph = initial;
    const view = renderHook(() => useUniqueNamePaths(null), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>{children}</HierarchyProvider>
      ),
    });
    const setGraph = (next: typeof initial) => {
      sceneGraph = next;
    };
    return { ...view, setGraph };
  }

  it('maps each claimed name to the live path of its claimant', () => {
    const { result } = renderPaths(graphWithHud());
    expect(result.current?.get('%Hud')).toBe('Root/Hud');
  });

  it('keeps the same map while a rebuilt table holds the same entries', () => {
    const view = renderPaths(graphWithHud());
    const first = view.result.current;
    view.setGraph(graphWithHud());
    view.rerender();
    expect(view.result.current).toBe(first);
  });

  it('is undefined outside a hierarchy', () => {
    const { result } = renderHook(() => useUniqueNamePaths(null));
    expect(result.current).toBeUndefined();
  });
});
