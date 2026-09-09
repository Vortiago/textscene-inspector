/**
 * The `%Name` claim table is built once per scene tree and shared by every hook
 * instance over it — every Sprite2D and MeshInstance3D asks for it on each
 * re-parse, and a per-instance memo walked the whole tree per node.
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph.js';
import type { TscnNode } from '../../parser/types.js';
import { HierarchyProvider } from './HierarchyContext.js';
import { useUniqueNameClaims } from './ViewportTextureContext.js';

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
