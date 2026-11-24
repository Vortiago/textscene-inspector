import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SceneStats } from './SceneStats';
import { openScene } from '../../../scene/openScene';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import '../../sceneLiveTree.js';

const PLAYER = `[gd_scene format=3]

[node name="Player" type="CharacterBody3D"]

[node name="Target" type="Node3D" parent="."]

[node name="FollowCam" type="Camera3D" parent="Target"]
`;

const FILES: ResourceProvider = {
  loadResource: async (path) => (path === 'res://player.tscn' ? PLAYER : null),
};

describe('<SceneStats>', () => {
  it('counts a camera nested inside an instance but keeps the authored node count', async () => {
    const scene = openScene({
      source: `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="4_ray"]

[node name="Game" type="Node3D"]

[node name="Player" parent="." instance=ExtResource("4_ray")]
`,
      provider: FILES,
      rootScenePath: 'res://game.tscn',
    });

    render(<SceneStats scene={scene} />);

    expect(await screen.findByText('1 camera')).toBeTruthy();
    // Authored: Game and the collapsed Player instance.
    expect(screen.getByTestId('scene-info-nodes').textContent).toBe('2 nodes');
  });

  // The chip counts by Godot's class tree: an XRCamera3D is a Camera3D.
  it('counts a Camera3D subclass (XRCamera3D)', async () => {
    const scene = openScene({
      source: `[gd_scene format=3]

[node name="World" type="Node3D"]

[node name="Eye" type="Camera3D" parent="."]

[node name="Headset" type="XRCamera3D" parent="."]
`,
      provider: FILES,
    });

    render(<SceneStats scene={scene} />);

    expect(await screen.findByText('2 cameras')).toBeTruthy();
  });

  // Godot 4.6.3 makes a placeholder Node of a class it cannot make, and the scene owns it.
  it('counts a node of a class Godot does not have', async () => {
    const scene = openScene({
      source: `[gd_scene format=3]

[node name="World" type="Node3D"]

[node name="X" type="SomeFutureNode" parent="."]
`,
      provider: FILES,
    });

    render(<SceneStats scene={scene} />);

    expect((await screen.findByTestId('scene-info-nodes')).textContent).toBe('2 nodes');
  });

  it('shows nothing before the host has sent a scene', () => {
    render(<SceneStats scene={openScene({ source: '', provider: FILES })} />);

    expect(screen.queryByTestId('scene-info-nodes')).toBeNull();
  });

  // Godot 4.6.3 gives Main the owner of Plain, Inst and Added, and Inst the owner of Inner and Deep.
  it('counts the nodes the scene owns, a node added inside an editable instance among them', async () => {
    const scene = openScene({
      source: `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://sub.tscn" id="1"]

[node name="Main" type="Node3D"]

[node name="Plain" type="Node3D" parent="."]

[node name="Inst" parent="Plain" instance=ExtResource("1")]

[node name="Added" type="Node3D" parent="Plain/Inst/Inner"]

[editable path="Plain/Inst"]
`,
      provider: {
        loadResource: async (path) =>
          path === 'res://sub.tscn'
            ? '[gd_scene format=3]\n\n[node name="SubRoot" type="Node3D"]\n\n' +
              '[node name="Inner" type="Node3D" parent="."]\n\n[node name="Deep" type="Node3D" parent="Inner"]\n'
            : null,
      },
      rootScenePath: 'res://main.tscn',
    });
    scene.getNodeOrNull('Plain/Inst');

    render(<SceneStats scene={scene} />);

    await waitFor(() => expect(screen.getByTestId('scene-info-nodes').textContent).toBe('4 nodes'));
  });
});
