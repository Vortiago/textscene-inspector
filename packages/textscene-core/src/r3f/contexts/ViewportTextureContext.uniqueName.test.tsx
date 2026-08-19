/**
 * Two `<SubViewport>`s claiming the same `%Name`, and which one `%Name` reaches.
 *
 * `_acquire_unique_name_in_owner` registers the FIRST claimant on the owner and
 * clears the later node's own flag (node.cpp:2225-2231). Publishing the alias
 * from the node's raw flag instead let both publish `Root/%View`, so the
 * registry kept whichever mounted last and a consumer sampled the wrong target.
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

// Built by the real builder, not a literal behind a cast: a hand-shaped graph
// keeps compiling after `SceneGraph` gains a field, and stops matching what
// `useUniqueNameClaims` reads.
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
    // Its flag is cleared, not the node: `Root/Hud/View` addresses it as ever.
    const { result } = renderHook(() => useViewportTexture('Root/Hud/View'), { wrapper });
    expect(result.current).toBe(loser);
  });
});
