import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { ViewportMode } from '../../contexts/ViewportModeContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';

// happy-dom has no WebGL. The notes sit beside the view, so the view is a stub.
vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: () => <div data-testid="view" />,
  TscnSceneContents: () => null,
}));

import { TextShell } from './TscnPreviewShell.testkit';

const TWO_SCRIPTS = `[gd_scene format=3]

[ext_resource type="Script" path="res://player.gd" id="1_player"]

[node name="Main" type="Node3D"]
script = ExtResource("1_player")

[node name="Player" type="Node3D" parent="."]
script = ExtResource("1_player")

[node name="Camera" type="Camera3D" parent="."]
`;

const NO_CAMERA_3D = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Box" type="MeshInstance3D" parent="."]
`;

const SPRITE_2D = `[gd_scene format=3]

[node name="Main" type="Node2D"]

[node name="Sprite" type="Sprite2D" parent="."]
`;

const NIL_SCRIPT = `[gd_scene format=3]

[node name="Main" type="Node2D"]
script = nil
`;

const SUBVIEWPORT_3D = `[gd_scene format=3]

[ext_resource type="Script" path="res://hud.gd" id="1_hud"]

[node name="Main" type="Control"]

[node name="View" type="SubViewport" parent="."]

[node name="Box" type="MeshInstance3D" parent="View"]
script = ExtResource("1_hud")
`;

const MISSING_SCRIPT = `[gd_scene format=3]

[ext_resource type="Script" path="res://player.gd" id="1_player"]
[ext_resource type="Script" path="res://gone.gd" id="2_gone"]

[node name="Main" type="Node3D"]
script = ExtResource("2_gone")

[node name="Player" type="Node3D" parent="."]
script = ExtResource("1_player")

[node name="Camera" type="Camera3D" parent="."]
`;

async function openIn(mode: ViewportMode, content: string) {
  render(<TextShell panelId={`notes-${mode}`} content={content} initialViewportMode={mode} />);
  await screen.findAllByText('Main');
}

const notes = () => screen.queryAllByTestId('game-start-note').map((note) => note.textContent);

describe('<TextShell> In-game notes', () => {
  it('says that scripts do not run, with the count of nodes that hold one', async () => {
    await openIn('in-game', TWO_SCRIPTS);
    expect(notes()).toEqual(['Scripts do not run: 2 nodes hold a script.']);
  });

  it('shows no scripts note for a scene with no script', async () => {
    await openIn('in-game', SPRITE_2D);
    expect(notes()).toEqual([]);
  });

  it('says that no camera is current for a 3D scene with no Camera3D', async () => {
    await openIn('in-game', NO_CAMERA_3D);
    expect(notes()).toEqual(['No Camera3D is current, so the 3D world does not draw.']);
  });

  it('shows no note in the editor’s 3D view, which draws through the editor camera', async () => {
    await openIn('3D', NO_CAMERA_3D);
    expect(notes()).toEqual([]);
  });

  it('counts no script for a script slot that holds nil', async () => {
    await openIn('in-game', NIL_SCRIPT);
    expect(notes()).toEqual([]);
  });

  it('counts a script inside a SubViewport, and needs no root camera for its 3D content', async () => {
    await openIn('in-game', SUBVIEWPORT_3D);
    expect(notes()).toEqual(['Scripts do not run: 1 node holds a script.']);
  });

  it('counts no script for a node whose script file is missing, as Godot readies none', async () => {
    const fake = createFakeResourceLoader();
    render(
      <ResourceLoaderProvider loader={fake.loader}>
        <TextShell panelId="notes-missing" content={MISSING_SCRIPT} initialViewportMode="in-game" />
      </ResourceLoaderProvider>
    );
    await screen.findAllByText('Main');
    act(() => {
      fake.loadOutcomes._resolve('res://gone.gd', {
        isFailed: true,
        chain: ['res://gone.gd'],
        cause: 'missing',
      });
      fake.loadOutcomes._resolve('res://player.gd', { isFailed: false });
    });
    expect(notes()).toEqual(['Scripts do not run: 1 node holds a script.']);
  });
});
