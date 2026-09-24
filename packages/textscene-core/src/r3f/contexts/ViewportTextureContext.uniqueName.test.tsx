/**
 * Two `<SubViewport>`s claim one `%Name`. `_acquire_unique_name_in_owner` keeps
 * the first claimant and clears the later node's flag (node.cpp:2225-2231), so
 * only the first publishes `Root/%View`.
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type * as THREE from 'three';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph.js';
import type { TscnNode } from '../../parser/types.js';
import { HierarchyProvider } from './HierarchyContext.js';
import {
  ViewportTextureProvider,
  useViewportTexture,
  usePublishViewportTexture,
  type ViewportTextureEntry,
} from './ViewportTextureContext.js';

function node(name: string, type: string, flagged = false): TscnNode {
  return {
    name,
    type,
    properties: {},
    rawProperties: flagged ? { unique_name_in_owner: 'true' } : {},
    children: [],
  };
}

const first = node('View', 'SubViewport', true);
const second = node('View', 'SubViewport', true);

/** Root/Ui/View and Root/Hud/View, in that declaration order. */
const roots: TscnNode[] = (() => {
  const root = node('Root', 'Node2D');
  const ui = node('Ui', 'Node2D');
  const hud = node('Hud', 'Node2D');
  ui.children.push(first);
  hud.children.push(second);
  root.children.push(ui, hud);
  return [root];
})();

// The real builder, not a cast literal, which keeps compiling after
// `SceneGraph` gains a field and stops matching what `useUniqueNameClaims` reads.
const graph = createSceneGraphFromTscnScene({ nodes: roots });

const entry = (id: string): ViewportTextureEntry => ({
  texture: { name: id } as THREE.Texture,
  size: { x: 4, y: 4 },
});

const winner = entry('ui');
const loser = entry('hud');

function Publisher({ n, path, e }: { n: TscnNode; path: string; e: ViewportTextureEntry }) {
  usePublishViewportTexture(n, path, e);
  return null;
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <HierarchyProvider value={{ sceneGraph: graph, panelId: 'panel' }}>
      <ViewportTextureProvider>
        <Publisher n={first} path="Root/Ui/View" e={winner} />
        <Publisher n={second} path="Root/Hud/View" e={loser} />
        {children}
      </ViewportTextureProvider>
    </HierarchyProvider>
  );
}

describe('a %Name two sub-viewports both claim', () => {
  it('resolves to the first claimant, not to whichever published last', () => {
    const { result } = renderHook(() => useViewportTexture('Root/%View'), { wrapper });
    expect(result.current).toBe(winner);
  });

  it('still reaches the later one by its own path', () => {
    // Only its flag is cleared, so `Root/Hud/View` still addresses it.
    const { result } = renderHook(() => useViewportTexture('Root/Hud/View'), { wrapper });
    expect(result.current).toBe(loser);
  });
});
