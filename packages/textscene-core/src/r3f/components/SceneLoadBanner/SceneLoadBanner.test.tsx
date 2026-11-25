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

const SECTION_READS_WOOD_NODE_READS_TRIM = `[gd_scene format=3]
[ext_resource type="Material" path="res://wood.tres" id="1"]
[ext_resource type="Resource" path="res://trim.tres" id="2"]
[sub_resource type="Resource" id="a"]
inner = ExtResource("1")
[node name="Root" type="Node2D"]
extra = ExtResource("2")
`;

const WOOD = `[gd_resource type="StandardMaterial3D" format=3]
[resource]
`;

const TRIM_ASKING_GONE = `[gd_resource type="Resource" format=3]
[resource]
material = Resource("res://wood.tres::gone")
`;

const NODE_READS_A_LITERAL_READS_B = `[gd_scene format=3]
[ext_resource type="Material" path="res://wood.tres::A" id="1"]
[node name="Root" type="Node2D"]
first = ExtResource("1")
second = Resource("res://wood.tres::B")
`;

function mount(files: Record<string, string>, source = MAIN) {
  const scene = openScene({
    source,
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
        'res://main.tscn:4 - Parse Error: [ext_resource] referenced non-existent resource at: res://atlas.tres.',
        'res://main.tscn → res://atlas.tres → res://gone.png (missing)',
      ].join('')
    );
  });

  it('shows nothing once each file the scene reads loads', async () => {
    const scene = mount({ 'res://atlas.tres': ATLAS, 'res://gone.png': 'bytes' });

    await waitFor(() => expect(scene.files().every((file) => file.state === 'loaded')).toBe(true));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows nothing when only a file a node reads asks for an address the section file lacks', async () => {
    const scene = mount(
      { 'res://wood.tres': WOOD, 'res://trim.tres': TRIM_ASKING_GONE },
      SECTION_READS_WOOD_NODE_READS_TRIM
    );

    await waitFor(() => expect(scene.files().every((file) => file.state === 'missing')).toBe(true));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('fails the scene on a Resource() literal of a second address the file lacks', async () => {
    mount({ 'res://wood.tres': WOOD }, NODE_READS_A_LITERAL_READS_B);

    expect((await screen.findByRole('alert')).textContent).toContain('res://wood.tres::B');
  });
});
