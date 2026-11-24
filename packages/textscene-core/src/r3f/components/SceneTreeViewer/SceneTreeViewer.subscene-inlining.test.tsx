import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expandAllRows, renderSceneTree, rowAt, type TreeFiles } from './sceneTree.testkit';

const scene = (body: string) => `[gd_scene format=3]\n\n${body}`;

async function renderTree(source: string, files: TreeFiles = {}, lastLoaded?: string) {
  const rendered = await renderSceneTree(scene(source), { files });
  await expandAllRows(rendered.scene, lastLoaded);
}

const COIN_FILES: TreeFiles = {
  'res://coin.tscn': scene(`[node name="Coin" type="Area3D"]

[node name="Circle" type="MeshInstance3D" parent="."]

[node name="Animation" type="AnimationPlayer" parent="."]
`),
};

/** Main with Coin1, an instance of coin.tscn, and the plain Plain beside it. */
const COIN_MAIN = `[ext_resource type="PackedScene" path="res://coin.tscn" id="coin"]

[node name="Main" type="Node3D"]

[node name="Coin1" parent="." instance=ExtResource("coin")]

[node name="Plain" type="Node3D" parent="."]

[editable path="Coin1"]
`;

describe('<SceneTreeViewer> instanced scenes', () => {
  it('lists the nodes of the scene the root inherits below the root row', async () => {
    await renderTree(
      `[ext_resource type="PackedScene" path="res://frame.tscn" id="frame"]

[node name="PhotoFrame1" instance=ExtResource("frame")]

[node name="Override" type="Node3D" parent="."]
`,
      {
        'res://frame.tscn': scene(
          '[node name="Frame" type="Node3D"]\n\n[node name="FrameMesh" type="MeshInstance3D" parent="."]\n'
        ),
      },
      'FrameMesh'
    );

    expect(rowAt('PhotoFrame1/FrameMesh')).not.toBeNull();
    expect(rowAt('PhotoFrame1/Override')).not.toBeNull();
  });

  it('resolves a nested instance in the resources of the scene that declares it', async () => {
    // Only a.tscn declares "9_b", so the outer scene cannot resolve Inner.
    await renderTree(
      `[ext_resource type="PackedScene" path="res://a.tscn" id="1_a"]

[node name="A" instance=ExtResource("1_a")]

[editable path="Inner"]
`,
      {
        'res://a.tscn': scene(`[ext_resource type="PackedScene" path="res://b.tscn" id="9_b"]

[node name="ARoot" type="Node3D"]

[node name="Inner" parent="." instance=ExtResource("9_b")]
`),
        'res://b.tscn': scene(
          '[node name="BRoot" type="Node3D"]\n\n[node name="Leaf" type="Node3D" parent="."]\n'
        ),
      },
      'Inner/Leaf'
    );

    expect(rowAt('A/Inner/Leaf')).not.toBeNull();
  });

  it('gives the instance row the class of the root of the scene it instances, with no row for that root', async () => {
    await renderTree(COIN_MAIN, COIN_FILES, 'Coin1/Animation');

    expect(within(rowAt('Main/Coin1')!).getByTitle('Area3D')).toBeTruthy();
    expect(rowAt('Main/Coin1/Circle')).not.toBeNull();
    expect(rowAt('Main/Coin1/Animation')).not.toBeNull();
    expect(rowAt('Main/Coin1/Coin')).toBeNull();
  });

  it('opens the scene an instance below the root instances', async () => {
    const onOpenSubScene = vi.fn();
    const rendered = await renderSceneTree(scene(COIN_MAIN), { files: COIN_FILES, onOpenSubScene });
    await expandAllRows(rendered.scene);

    fireEvent.click(screen.getByRole('button', { name: /open sub-scene standalone/i }));

    expect(onOpenSubScene).toHaveBeenCalledWith('res://coin.tscn');
  });

  it('offers no open action on a row that instances no scene', async () => {
    await renderTree(COIN_MAIN, COIN_FILES, 'Coin1/Animation');

    expect(
      within(rowAt('Main/Plain')!).queryByRole('button', { name: /open sub-scene standalone/i })
    ).toBeNull();
  });

  it('shows a row with no listed child as a leaf', async () => {
    await renderTree(COIN_MAIN, COIN_FILES, 'Coin1/Animation');

    expect(rowAt('Main/Plain')!.textContent).toContain('•');
    expect(rowAt('Main/Plain')!.textContent).not.toContain('▶');
  });

  it('reaches a node inside an instanced scene by search, with the instance row above it', async () => {
    await renderTree(
      `[ext_resource type="PackedScene" path="res://frame.tscn" id="f"]

[node name="Main" type="Node3D"]

[node name="Frame" parent="." instance=ExtResource("f")]

[node name="Other" type="Node3D" parent="."]

[editable path="Frame"]
`,
      {
        'res://frame.tscn': scene(
          '[node name="FrameRoot" type="Node3D"]\n\n[node name="SpecialMesh" type="Node3D" parent="."]\n'
        ),
      },
      'Frame/SpecialMesh'
    );

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'special' } });

    expect(screen.getByText('Frame')).toBeTruthy();
    expect(screen.getByText('SpecialMesh')).toBeTruthy();
    expect(screen.queryByText('Other')).toBeNull();
  });
});
