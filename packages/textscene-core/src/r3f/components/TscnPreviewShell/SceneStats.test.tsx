/**
 * The node count is the authored count, instances collapsed as in Godot's
 * scene dock. The camera count comes from the live scene tree, so it includes
 * cameras inside sub-scenes.
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
    // Authored: Game and the collapsed Player instance.
    expect(screen.getByTestId('scene-info-nodes').textContent).toBe('2 nodes');
  });

  // The chip counts by Godot's class tree: an XRCamera3D is a Camera3D.
  it('counts a Camera3D subclass (XRCamera3D)', () => {
    const parsed = new TscnParser().parse(`[gd_scene format=3]

[node name="World" type="Node3D"]

[node name="Eye" type="Camera3D" parent="."]

[node name="Headset" type="XRCamera3D" parent="."]
`);
    const sceneGraph = createSceneGraphFromTscnScene(parsed, 'res://xr.tscn');

    render(
      <ResourceLoaderProvider loader={makeLoader({})}>
        <HierarchyProvider value={{ sceneGraph, panelId: 'stats-xr' }}>
          <SceneStats />
        </HierarchyProvider>
      </ResourceLoaderProvider>
    );

    expect(screen.getByText('2 cameras')).toBeTruthy();
  });
});
