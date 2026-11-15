/**
 * A TileMap's layers are live children of the TileMap: Godot makes each one a TileMapLayer and adds
 * it as an internal front child (`tile_map.cpp:277-279`), so it sits before the authored children.
 */
import { describe, expect, it } from 'vitest';
import { liveTreeOfText, livePathsOf } from './liveSceneTree.testkit';
import type { TileMapLayerProperties } from '../nodes/2d/tiles/tilemaplayer/types';
import './nodes/index';

const MAP = `[gd_scene format=3]

[sub_resource type="TileSet" id="ts"]
tile_size = Vector2i(16, 16)

[node name="Map" type="TileMap"]
tile_set = SubResource("ts")
format = 2
layer_0/tile_data = PackedInt32Array(0, 0, 0)
layer_1/name = "Top"
layer_1/z_index = 3
layer_1/tile_data = PackedInt32Array(65537, 0, 0)

[node name="Authored" type="Node2D" parent="."]
`;

const tree = liveTreeOfText(MAP, {});
const childPaths = livePathsOf(tree).filter((path) => /^Map\/[^/]+$/.test(path));

describe('the layers of a TileMap', () => {
  it('come before the authored children, one for each layer', () => {
    expect(childPaths).toEqual(['Map/@TileMapLayer@0', 'Map/@TileMapLayer@1', 'Map/Authored']);
  });

  it('are TileMapLayers that hold their layer cells and leave scene tiles to the TileMap', () => {
    const layer = tree.at('Map/@TileMapLayer@1')!.step.node;
    const props = layer.properties as TileMapLayerProperties;
    expect([layer.type, props.z_index, props.cells?.length, props.drawsSceneTiles]).toEqual([
      'TileMapLayer',
      3,
      1,
      false,
    ]);
  });

  it('are unowned, so the dock lists none and a click selects the TileMap', () => {
    expect(tree.at('Map/@TileMapLayer@0')!.raw.isUnowned).toBe(true);
  });

  it('take the CanvasItem state a TileMap forwards, and not its top_level or clip_children', () => {
    // `TileMap::set_light_mask`, `set_self_modulate` and the texture setters reach each layer
    // (`tile_map.cpp:799-830`). No other CanvasItem property does.
    const forwarding = liveTreeOfText(
      MAP.replace(
        'format = 2\n',
        'format = 2\ntop_level = true\nclip_children = 1\nlight_mask = 5\nself_modulate = Color(1, 0, 0, 1)\n'
      ),
      {}
    );
    const props = forwarding.at('Map/@TileMapLayer@0')!.step.node.properties as TileMapLayerProperties;
    expect([props.top_level, props.clip_children, props.light_mask, props.self_modulate]).toEqual([
      false,
      0,
      5,
      { r: 1, g: 0, b: 0, a: 1 },
    ]);
  });
});
