/** `useHasLiveTree` answers "is there a tree to walk", which an empty walk alone cannot. */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { TscnParser } from '../parser/TscnParser';
import { createSceneGraphFromTscnScene, type SceneGraph } from '../core/SceneGraph';
import { HierarchyProvider } from './contexts/HierarchyContext';
import { useHasLiveTree } from './useLiveSceneTree';

function withGraph(sceneGraph: SceneGraph | null) {
  return ({ children }: { children: ReactNode }) => (
    <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>{children}</HierarchyProvider>
  );
}

const EMPTY_SCENE = '[gd_scene format=3]\n\n[node name="Root" type="Node2D"]\n';

describe('useHasLiveTree', () => {
  it('sees a tree under a parsed scene, even one with nothing to match', () => {
    const graph = createSceneGraphFromTscnScene(new TscnParser().parse(EMPTY_SCENE));
    expect(renderHook(useHasLiveTree, { wrapper: withGraph(graph) }).result.current).toBe(true);
  });

  it('sees none with no hierarchy at all', () => {
    expect(renderHook(useHasLiveTree).result.current).toBe(false);
  });

  it('sees none under a scene graph that lacks its root scene', () => {
    const graph = { rootScene: 'res://missing.tscn', scenes: new Map() } as unknown as SceneGraph;
    expect(renderHook(useHasLiveTree, { wrapper: withGraph(graph) }).result.current).toBe(false);
  });
});
