/**
 * SceneStats chips: node count is the AUTHORED count (instances collapsed,
 * matching Godot's scene dock); camera count comes from the LIVE scene tree, so
 * cameras inside instanced sub-scenes are included (consistent with the Cameras
 * panel and the live tree).
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SceneStats } from './SceneStats';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { ResourceEventBus } from '../../../resources/ResourceEventBus';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph';
import { TscnParser } from '../../../parser/TscnParser';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import type { TscnNode, TscnScene } from '../../../parser/types';

function makeNode(name: string, type: string, extras: Partial<TscnNode> = {}): TscnNode {
  return { name, type, children: [], properties: {}, ...extras };
}

function makeLoader(scenes: Record<string, TscnScene>): ResourceLoader {
  const proc = <T,>(cache: Record<string, T>) => ({
    getCached: (p: string) => cache[p],
    isCached: (p: string) => p in cache,
    isLoading: () => false,
    request: () => {},
    clearCache: () => {},
    getCacheSize: () => Object.keys(cache).length,
  });
  return {
    eventBus: new ResourceEventBus(),
    scenes: proc<TscnScene>(scenes),
    glbMeshes: proc<never>({}),
    register: () => {},
  } as unknown as ResourceLoader;
}

describe('<SceneStats>', () => {
  it('counts a camera nested inside an instance (live tree) but keeps the authored node count', () => {
    const root = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="4_ray"]

[node name="Game" type="Node3D"]

[node name="Player" parent="." instance=ExtResource("4_ray")]
`;
    const playerScene: TscnScene = {
      nodes: [
        makeNode('Player', 'CharacterBody3D', {
          children: [makeNode('Target', 'Node3D', { children: [makeNode('FollowCam', 'Camera3D')] })],
        }),
      ],
      externalResources: [],
      internalResources: [],
    };
    const parsed = new TscnParser().parse(root);
    const sceneGraph = createSceneGraphFromTscnScene(parsed, 'res://game.tscn');
    const loader = makeLoader({ 'res://player.tscn': playerScene });

    render(
      <ResourceLoaderProvider loader={loader}>
        <HierarchyProvider value={{ sceneGraph, panelId: 'stats' }}>
          <SceneStats />
        </HierarchyProvider>
      </ResourceLoaderProvider>
    );

    // Live camera count includes the sub-scene FollowCam.
    expect(screen.getByText('1 camera')).toBeTruthy();
    // Node count is authored (Game + the collapsed Player instance) — not the
    // expanded live tree.
    expect(screen.getByTestId('scene-info-nodes').textContent).toBe('2 nodes');
  });
});
