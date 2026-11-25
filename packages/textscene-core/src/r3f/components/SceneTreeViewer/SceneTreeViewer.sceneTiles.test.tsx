/**
 * Godot adds a scene tile instance to its layer with no owner (`tile_map_layer.cpp:1646`), so the
 * Scene dock lists no row for it. The panel follows the dock.
 */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { expandAllRows, renderSceneTree } from './sceneTree.testkit';

const CRATE = `[gd_scene format=3]

[node name="Crate" type="Node2D"]
`;

const TILE_SET = `[gd_resource type="TileSet" format=3]

[ext_resource type="PackedScene" path="res://crate.tscn" id="crate"]

[sub_resource type="TileSetScenesCollectionSource" id="scenes"]
scenes/1/scene = ExtResource("crate")

[resource]
tile_size = Vector2i(32, 32)
sources/0 = SubResource("scenes")
`;

/** One layer with a crate scene tile at cell (0, 0) and no authored child. */
const LEVEL = `[gd_scene format=3]

[ext_resource type="TileSet" path="res://tiles.tres" id="ts"]

[node name="Level" type="Node2D"]

[node name="Layer" type="TileMapLayer" parent="."]
tile_map_data = PackedByteArray(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0)
tile_set = ExtResource("ts")
`;

/** One TileMap whose layer 0 holds a crate scene tile at cell (0, 0), with no authored child. */
const OLD_LEVEL = `[gd_scene format=3]

[ext_resource type="TileSet" path="res://tiles.tres" id="ts"]

[node name="Level" type="Node2D"]

[node name="Map" type="TileMap" parent="."]
tile_set = ExtResource("ts")
format = 2
layer_0/tile_data = PackedInt32Array(0, 0, 65536)
`;

/** Renders the panel over `level`, with the crate scene and the TileSet file, and expands every row. */
async function renderPanel(level: string) {
  const { scene } = await renderSceneTree(level, {
    files: { 'res://crate.tscn': CRATE, 'res://tiles.tres': TILE_SET },
  });
  await expandAllRows(scene);
}

describe('<SceneTreeViewer> scene tiles', () => {
  it('lists no row for the scene tile instances of a TileMapLayer', async () => {
    await renderPanel(LEVEL);

    expect(screen.getByText('Layer')).toBeTruthy();
    expect(document.querySelectorAll('[data-node-path]')).toHaveLength(2);
  });

  it('lists no row for the scene tile instances of a TileMap', async () => {
    await renderPanel(OLD_LEVEL);

    expect(screen.getByText('Map')).toBeTruthy();
    expect(document.querySelectorAll('[data-node-path]')).toHaveLength(2);
  });
});
