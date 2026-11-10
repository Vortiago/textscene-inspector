/**
 * A TileMap adds the instances of each of its layers as children of the TileMap node
 * (`tile_map_layer.cpp:1645-1652`): they take its transform, and neither a layer's `modulate` nor
 * its `z_index`.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { resolvePathFromObject } from '../../../../r3f/hooks/resolvePathFromObject';
import { TILE_TRANSFORM_FLIP_H } from '../../../../godot/scene/tileSet';
import type { PlacedCell } from '../shared/tileData';
import {
  SCENE_TILESET_RESOURCES,
  boxesInPaintOrder,
  drawnMeshes,
  drawnBoxes,
  onlyMesh,
  renderSceneTiles,
  withLayerCells,
} from '../shared/sceneTiles.testkit';

function mapScene(mapExtra = '', authoredChildren = ''): string {
  return `[gd_scene format=3]

${SCENE_TILESET_RESOURCES}
[node name="Root" type="Node2D"]

[node name="Map" type="TileMap" parent="."]
position = Vector2(100, 20)
format = 2
tile_set = SubResource("tileset")
layer_0/name = "First"
layer_1/name = "Second"
${mapExtra}${authoredChildren}`;
}

const cell = (x: number, y: number, alternativeId: number): PlacedCell => ({
  coords: { x, y },
  sourceId: 0,
  atlasCoords: { x: 0, y: 0 },
  alternativeId,
});

/** Sets the cells of each layer, which the parse would read from `layer_N/tile_data`. */
describe('TileMap scene tiles', () => {
  it('draws the instance at the cell, flipped, in the TileMap transform', async () => {
    const { renderer } = await renderSceneTiles(mapScene(), {
      prepare: withLayerCells([cell(1, 0, 1 | TILE_TRANSFORM_FLIP_H)]),
    });
    expect(drawnBoxes(renderer)).toEqual([[176, 52, 20, 10]]);
  });

  it('draws the instances of a later layer over those of an earlier one', async () => {
    const { renderer } = await renderSceneTiles(mapScene(), {
      prepare: withLayerCells([cell(0, 6, 5)], [cell(0, 5, 4)]),
    });
    expect(boxesInPaintOrder(renderer)).toEqual([
      [117, 336, 30, 100],
      [122, 272, 20, 100],
    ]);
  });

  it('draws no instance of a disabled layer', async () => {
    const { renderer } = await renderSceneTiles(mapScene('layer_0/enabled = false\n'), {
      prepare: withLayerCells([cell(0, 0, 1)], [cell(2, 0, 1)]),
    });
    expect(drawnBoxes(renderer)).toEqual([[260, 52, 20, 10]]);
  });

  it('keeps the instances of the other layers mounted when a layer is toggled', async () => {
    const prepare = withLayerCells([cell(0, 0, 1)], [cell(2, 0, 1)]);
    const { renderer, edit } = await renderSceneTiles(mapScene(), { prepare });
    const instanceAt260 = () => drawnMeshes(renderer).find(({ box }) => box[0] === 260)!.mesh;
    const before = instanceAt260();
    await edit(mapScene('layer_0/enabled = false\n'), prepare);
    expect(drawnBoxes(renderer)).toEqual([[260, 52, 20, 10]]);
    expect(instanceAt260()).toBe(before);
  });

  it('takes no z_index of the layer: an authored child above the TileMap still covers the instance', async () => {
    const authored = `
[node name="Authored" type="Polygon2D" parent="Map"]
z_index = 1
polygon = PackedVector2Array(64, 300, 114, 300, 114, 340, 64, 340)
`;
    const { renderer } = await renderSceneTiles(mapScene('layer_0/z_index = 5\n', authored), {
      prepare: withLayerCells([cell(1, 5, 4)]),
    });
    expect(boxesInPaintOrder(renderer)).toEqual([
      [186, 272, 20, 100],
      [164, 320, 50, 40],
    ]);
  });

  it('takes no modulate of the layer: the instance keeps its own colour', async () => {
    const { renderer } = await renderSceneTiles(mapScene('layer_0/modulate = Color(0, 0, 1, 1)\n'), {
      prepare: withLayerCells([cell(0, 5, 4)]),
    });
    const { color } = onlyMesh(renderer).material as THREE.MeshBasicMaterial;
    expect([color.r, color.g, color.b]).toEqual([1, 1, 0]);
  });

  it('selects the TileMap on a click on an instance', async () => {
    const { renderer, probe } = await renderSceneTiles(mapScene(), {
      prepare: withLayerCells([cell(0, 0, 1)]),
    });
    const mesh = onlyMesh(renderer);
    expect(resolvePathFromObject(mesh, probe.selection!.objectPathMap)).toBe('Root/Map');
    expect(probe.livePaths).toEqual(['Root', 'Root/Map']);
  });
});

describe('y-sorted TileMap scene tiles', () => {
  it('draws the instance at the cell', async () => {
    const { renderer } = await renderSceneTiles(mapScene('y_sort_enabled = true\n'), {
      prepare: withLayerCells([cell(1, 0, 1 | TILE_TRANSFORM_FLIP_H)]),
    });
    expect(drawnBoxes(renderer)).toEqual([[176, 52, 20, 10]]);
  });
});
