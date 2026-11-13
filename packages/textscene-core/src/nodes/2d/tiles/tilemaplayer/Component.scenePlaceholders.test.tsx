/**
 * With the Gizmos toggle on, a TileMapLayer marks a scene tile that has no scene, or asks for it
 * with `display_placeholder`, by a translucent disc of a quarter of the shorter tile side
 * (`tile_map_layer.cpp:1661-1700`). The disc tints with the layer's modulate, as a child item does.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { PlacedCell } from '../shared/tileData';
import { drawnBoxes, onlyMesh, renderSceneTiles, withCells } from '../shared/sceneTiles.testkit';
import { PLACEHOLDER_TILESET_RESOURCES } from '../shared/scenePlaceholders.testkit';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { placeholderColorOf } from '../../../../resources/tileset/scenePlaceholder.testkit';

const layerScene = (layerExtra = '') => `[gd_scene format=3]

${PLACEHOLDER_TILESET_RESOURCES}
[node name="Root" type="Node2D"]

[node name="Layer" type="TileMapLayer" parent="."]
position = Vector2(100, 20)
tile_set = SubResource("tileset")
${layerExtra}`;

const cell = (x: number, y: number, alternativeId: number, sourceId = 0): PlacedCell => ({
  coords: { x, y },
  sourceId,
  atlasCoords: { x: 0, y: 0 },
  alternativeId,
});

async function renderLayer(cells: PlacedCell[], options: { showGizmos: boolean; layerExtra?: string }) {
  const { renderer } = await renderSceneTiles(layerScene(options.layerExtra), {
    showGizmos: options.showGizmos,
    prepare: withCells(cells),
  });
  return renderer;
}

describe('TileMapLayer scene tile placeholders', () => {
  it('draws a disc of a quarter of the tile at a cell with no scene', async () => {
    // The cell centre is (100 + 64 + 32, 20 + 32): a disc of radius 16 around it.
    expect(drawnBoxes(await renderLayer([cell(1, 0, 6)], { showGizmos: true }))).toEqual([[180, 36, 32, 32]]);
  });

  it('draws the disc in the colour Godot derives from the ids', async () => {
    const material = onlyMesh(await renderLayer([cell(1, 0, 6)], { showGizmos: true }))
      .material as THREE.MeshBasicMaterial;
    const expected = placeholderColorOf(0, 6);
    expect(material.opacity).toBeCloseTo(0.8, 6);
    // The gizmo colour is linear: the sRGB channels, decoded.
    const linear = godotColorToLinear(expected);
    expect(material.color.r).toBeCloseTo(linear.r, 6);
    expect(material.color.g).toBeCloseTo(linear.g, 6);
    expect(material.color.b).toBeCloseTo(linear.b, 6);
  });

  it('draws nothing while the Gizmos toggle is off', async () => {
    expect(drawnBoxes(await renderLayer([cell(1, 0, 6)], { showGizmos: false }))).toEqual([]);
  });

  it('draws the disc beside the instance of a tile that asks for its placeholder', async () => {
    const boxes = drawnBoxes(await renderLayer([cell(0, 0, 1)], { showGizmos: true }));
    expect(boxes).toEqual([
      [116, 36, 32, 32],
      [132, 52, 20, 10],
    ]);
  });

  it('draws the disc for a scene whose loaded root is a plain Node, which has no scene', async () => {
    expect(drawnBoxes(await renderLayer([cell(1, 0, 7)], { showGizmos: true }))).toEqual([[180, 36, 32, 32]]);
  });

  it('draws no disc for a scene that has not loaded', async () => {
    const { renderer } = await renderSceneTiles(layerScene(), {
      showGizmos: true,
      withheldScenes: ['res://plain.tscn'],
      prepare: withCells([cell(1, 0, 7)]),
    });
    expect(drawnBoxes(renderer)).toEqual([]);
  });

  it('draws the disc for a scene that failed to load, as for a tile with no scene', async () => {
    // `get_scene_tile_scene` is null for a missing scene (`tile_map_layer.cpp:1683`).
    const { renderer } = await renderSceneTiles(layerScene(), {
      showGizmos: true,
      failedScenes: ['res://polygon.tscn'],
      prepare: withCells([cell(1, 0, 1)]),
    });
    expect(drawnBoxes(renderer)).toEqual([[180, 36, 32, 32]]);
  });

  it('draws nothing for a scene Godot refuses to instantiate, as add_child(nullptr) does', async () => {
    // The scene is valid, so there is no disc (`:1683`), and `instantiate()` returns null (`:1632`).
    const { renderer } = await renderSceneTiles(layerScene(), {
      showGizmos: true,
      prepare: withCells([cell(1, 0, 12)]),
    });
    expect(drawnBoxes(renderer)).toEqual([]);
  });

  it.each([
    ['a scene that instances itself', 18, []],
    ['a scene that instances an absent scene', 19, ['res://absent.tscn']],
  ])(
    'draws no tile disc for a tile whose scene is %s, only the marker of its failed child',
    async (_name, id, failedScenes) => {
      // Godot 4.6.3 loads the tile scene and drops the child it cannot instantiate, so the tile draws
      // an empty Node2D. The previewer marks that child as it marks any failed instance.
      const { renderer } = await renderSceneTiles(layerScene(), {
        showGizmos: true,
        failedScenes,
        prepare: withCells([cell(1, 0, id)]),
      });
      expect(drawnBoxes(renderer)).toEqual([[196, 52, 1, 1]]);
    }
  );

  it('draws no disc for a tile with a scene and no flag', async () => {
    expect(drawnBoxes(await renderLayer([cell(0, 1, 2)], { showGizmos: true }))).toEqual([
      [127, 111, 10, 10],
    ]);
  });

  it.each([
    ['a scene id the source lacks', cell(0, 0, 20)],
    ['a source the TileSet lacks', cell(0, 0, 6, 5)],
  ])('draws no disc for %s', async (_name, placed) => {
    expect(drawnBoxes(await renderLayer([placed], { showGizmos: true }))).toEqual([]);
  });

  it('draws no disc on a disabled layer', async () => {
    expect(
      drawnBoxes(await renderLayer([cell(1, 0, 6)], { showGizmos: true, layerExtra: 'enabled = false\n' }))
    ).toEqual([]);
  });

  it("tints the disc with the layer's modulate", async () => {
    const renderer = await renderLayer([cell(1, 0, 6)], {
      showGizmos: true,
      layerExtra: 'modulate = Color(1, 1, 1, 0.5)\n',
    });
    expect((onlyMesh(renderer).material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(0.4, 6);
  });

  it('draws the disc on a y-sorted layer too', async () => {
    const boxes = drawnBoxes(
      await renderLayer([cell(1, 0, 6)], { showGizmos: true, layerExtra: 'y_sort_enabled = true\n' })
    );
    expect(boxes).toEqual([[180, 36, 32, 32]]);
  });
});
