import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { fileBytes } from '../../../resources/testing/fileBytes';
import { renderInspector } from './inspector.testkit';

const LAMP = `[gd_scene format=3]

[node name="ceiling_lamp" type="Node3D"]

[node name="plafoniera" type="MeshInstance3D" parent="."]
`;

const ROOM = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://ceiling_lamp.tscn" id="3_as5ck"]

[node name="RoomGeometry" type="Node3D"]

[node name="ceiling_lamp" parent="." instance=ExtResource("3_as5ck")]

[node name="InlineNode" type="Node3D" parent="."]
`;

const FILES = { 'res://ceiling_lamp.tscn': LAMP };

/** Rig, its mesh Torso, and Arm below Torso. */
const RIG_GLB = fileBytes(
  join(import.meta.dirname, '../../../../../../scenes/fixtures/meshes/unit-glb-rig.glb')
);

describe('<NodeDetailsPanel> over an instance', () => {
  it('shows a node inside an instanced scene once the scene loads', async () => {
    await renderInspector(ROOM, 'RoomGeometry/ceiling_lamp/plafoniera', { files: FILES });

    expect(screen.getByRole('heading', { name: 'plafoniera' })).toBeTruthy();
    expect(screen.getByText('RoomGeometry/ceiling_lamp/plafoniera')).toBeTruthy();
  });

  it('shows a node the host file adds beside the instance', async () => {
    await renderInspector(ROOM, 'RoomGeometry/InlineNode', { files: FILES });
    expect(screen.getByRole('heading', { name: 'InlineNode' })).toBeTruthy();
  });

  it("shows an instance root by the class of its scene's root and the scene it instances", async () => {
    const coin = `[gd_scene format=3]\n\n[node name="Coin" type="Area3D"]\n`;
    const level = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://coin.tscn" id="7_coin"]

[node name="Level" type="Node3D"]

[node name="Coin1" parent="." instance=ExtResource("7_coin")]
`;
    await renderInspector(level, 'Level/Coin1', { files: { 'res://coin.tscn': coin } });

    expect(screen.getByText('Area3D')).toBeTruthy();
    expect(await screen.findByText('res://coin.tscn')).toBeTruthy();
  });

  it('shows the texture the host file sets over the one its instance sets, under an id both files hold', async () => {
    const sprite = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://inner.png" id="1"]

[node name="Sprite" type="Sprite2D"]
texture = ExtResource("1")
`;
    const hero = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://outer.png" id="1"]
[ext_resource type="PackedScene" path="res://sprite.tscn" id="2"]

[node name="Hero" instance=ExtResource("2")]
texture = ExtResource("1")
`;
    await renderInspector(hero, 'Hero', { files: { 'res://sprite.tscn': sprite } });

    expect(await screen.findByText('res://outer.png')).toBeTruthy();
    expect(screen.queryByText('res://inner.png')).toBeNull();
  });
});

describe('<NodeDetailsPanel> copy node path inside an instance', () => {
  async function copyFor(source: string, selected: string, files: Record<string, string | ArrayBuffer>) {
    const onCopyNodePath = vi.fn();
    await renderInspector(source, selected, { files, onCopyNodePath });
    await act(async () => screen.getByRole('button', { name: 'Copy node path' }).click());
    return onCopyNodePath;
  }

  it('copies the path through the instance node', async () => {
    const copied = await copyFor(ROOM, 'RoomGeometry/ceiling_lamp/plafoniera', FILES);
    expect(copied).toHaveBeenCalledExactlyOnceWith('ceiling_lamp/plafoniera');
  });

  it('copies the path Godot gives a node of an instanced glTF', async () => {
    const body = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://rig.glb" id="1_rig"]

[node name="Root" type="Node3D"]

[node name="Body" parent="." instance=ExtResource("1_rig")]
`;
    const copied = await copyFor(body, 'Root/Body/Rig/Torso', { 'res://rig.glb': RIG_GLB });
    expect(copied).toHaveBeenCalledExactlyOnceWith('Body/Rig/Torso');
  });
});
