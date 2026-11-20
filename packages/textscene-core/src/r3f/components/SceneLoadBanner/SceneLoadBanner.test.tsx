import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '../../sceneLiveTree';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { openScene } from '../../../scene/openScene';
import { SceneLoadBanner } from './SceneLoadBanner';

const MAIN = `[gd_scene format=3]
[ext_resource type="Texture2D" path="res://atlas.tres" id="1"]
[sub_resource type="AtlasTexture" id="a"]
atlas = ExtResource("1")
[node name="Root" type="Node2D"]
`;

const ATLAS = `[gd_resource type="AtlasTexture" format=3]
[ext_resource type="Texture2D" path="res://gone.png" id="1"]
[resource]
atlas = ExtResource("1")
`;

function mount(files: Record<string, string>) {
  const scene = openScene({
    source: MAIN,
    provider: { loadResource: async (path) => files[path] ?? null },
    rootScenePath: 'res://main.tscn',
  });
  render(
    <HierarchyProvider value={{ sceneGraph: scene.parse().sceneGraph, panelId: 'p', scene }}>
      <SceneLoadBanner />
    </HierarchyProvider>
  );
  return scene;
}

describe('<SceneLoadBanner>', () => {
  it('says the game would fail to load the scene, with Godot line and the chain', async () => {
    mount({ 'res://atlas.tres': ATLAS });

    expect((await screen.findByRole('alert')).textContent).toBe(
      [
        'The game would fail to load this scene',
        'res://main.tscn - Parse Error: [ext_resource] referenced non-existent resource at: res://atlas.tres.',
        'res://main.tscn → res://atlas.tres → res://gone.png (missing)',
      ].join('')
    );
  });

  it('shows nothing once each file the scene reads loads', async () => {
    const scene = mount({ 'res://atlas.tres': ATLAS, 'res://gone.png': 'bytes' });

    await waitFor(() => expect(scene.files().every((file) => file.state === 'loaded')).toBe(true));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
