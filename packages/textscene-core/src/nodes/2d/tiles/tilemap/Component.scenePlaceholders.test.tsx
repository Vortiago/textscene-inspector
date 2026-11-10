/**
 * A TileMap draws the placeholder disc of each of its layers' scene tiles, tinted by that layer's
 * `modulate`, whether or not the TileMap is y-sorted.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { PlacedCell } from '../shared/tileData';
import { drawnBoxes, drawnMeshes, renderSceneTiles, withLayerCells } from '../shared/sceneTiles.testkit';
import { PLACEHOLDER_TILESET_RESOURCES } from '../shared/scenePlaceholders.testkit';

const mapScene = (mapExtra = '') => `[gd_scene format=3]

${PLACEHOLDER_TILESET_RESOURCES}
[node name="Root" type="Node2D"]

[node name="Map" type="TileMap" parent="."]
position = Vector2(100, 20)
format = 2
tile_set = SubResource("tileset")
layer_0/name = "First"
layer_1/name = "Second"
layer_1/modulate = Color(1, 1, 1, 0.5)
${mapExtra}`;

const placeholderCell = (x: number): PlacedCell => ({
  coords: { x, y: 0 },
  sourceId: 0,
  atlasCoords: { x: 0, y: 0 },
  alternativeId: 6,
});

const opacityOf = ({ mesh }: { mesh: THREE.Object3D }) =>
  ((mesh as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity;

describe.each([
  ['a TileMap', ''],
  ['a y-sorted TileMap', 'y_sort_enabled = true\n'],
])('%s scene tile placeholders', (_name, mapExtra) => {
  it('draws the discs of every layer, tinted by the modulate of its own layer', async () => {
    const { renderer } = await renderSceneTiles(mapScene(mapExtra), {
      showGizmos: true,
      prepare: withLayerCells([placeholderCell(1)], [placeholderCell(2)]),
    });
    const discs = drawnMeshes(renderer).sort((a, b) => a.box[0] - b.box[0]);
    expect(discs.map(({ box }) => box)).toEqual([
      [180, 36, 32, 32],
      [244, 36, 32, 32],
    ]);
    expect(discs.map(opacityOf)).toEqual([expect.closeTo(0.8, 6), expect.closeTo(0.4, 6)]);
  });

  it('draws no disc while the Gizmos toggle is off', async () => {
    const { renderer } = await renderSceneTiles(mapScene(mapExtra), {
      showGizmos: false,
      prepare: withLayerCells([placeholderCell(1)]),
    });
    expect(drawnBoxes(renderer)).toEqual([]);
  });
});
