/**
 * A TileMapLayer instantiates the scene of each cell that names a `TileSetScenesCollectionSource`
 * tile (`tile_map_layer.cpp:1569-1599`). The expected boxes are the ones Godot 4.6.3 measured
 * (`pnpm ref:godot --mode 2d`) for the same TileSet, in Godot's y-down pixels.
 */
import { describe, it, expect } from 'vitest';
import { resolvePathFromObject } from '../../../../r3f/hooks/resolvePathFromObject';
import {
  TILE_TRANSFORM_FLIP_H,
  TILE_TRANSFORM_FLIP_V,
  TILE_TRANSFORM_TRANSPOSE,
} from '../../../../godot/scene/tileSet';
import type { PlacedCell } from '../shared/tileData';
import type { TscnScene } from '../../../../parser/types';
import {
  SCENE_TILESET_RESOURCES,
  boxesInPaintOrder,
  drawnMeshes,
  drawnBoxes,
  onlyMesh,
  nodesOfType,
  renderSceneTiles,
} from '../shared/sceneTiles.testkit';
import type { TileMapLayerProperties } from './types';

function layerScene(layerExtra = ''): string {
  return `[gd_scene format=3]

${SCENE_TILESET_RESOURCES}
[node name="Root" type="Node2D"]

[node name="Layer" type="TileMapLayer" parent="."]
position = Vector2(100, 20)
tile_set = SubResource("tileset")
${layerExtra}`;
}

const cell = (
  x: number,
  y: number,
  alternativeId: number,
  overrides: Partial<PlacedCell> = {}
): PlacedCell => ({
  coords: { x, y },
  sourceId: 0,
  atlasCoords: { x: 0, y: 0 },
  alternativeId,
  ...overrides,
});

/** Sets the cells of the layer, which the parse would read from `tile_map_data`. */
const withCells = (cells: PlacedCell[]) => (scene: TscnScene) => {
  (nodesOfType(scene, 'TileMapLayer')[0]!.properties as TileMapLayerProperties).cells = cells;
};

function renderWithProbe(cells: PlacedCell[], layerExtra = '', authoredChildren = '') {
  return renderSceneTiles(layerScene(layerExtra) + authoredChildren, { prepare: withCells(cells) });
}

async function render(cells: PlacedCell[], layerExtra = '', authoredChildren = '') {
  return (await renderWithProbe(cells, layerExtra, authoredChildren)).renderer;
}

describe('TileMapLayer scene tiles', () => {
  it.each([
    ['a Node2D root at the cell', cell(0, 0, 1), [132, 52, 20, 10]],
    ['a flip h', cell(1, 0, 1 | TILE_TRANSFORM_FLIP_H), [176, 52, 20, 10]],
    ['a flip v', cell(2, 0, 1 | TILE_TRANSFORM_FLIP_V), [260, 42, 20, 10]],
    ['a transpose', cell(3, 0, 1 | TILE_TRANSFORM_TRANSPOSE), [324, 52, 10, 20]],
    ['a Control root at the cell', cell(0, 1, 2), [127, 111, 10, 10]],
    ['a Control root ignoring a flip h', cell(1, 1, 2 | TILE_TRANSFORM_FLIP_H), [191, 111, 10, 10]],
    ['a Node2D root with its own position', cell(2, 1, 3), [265, 119, 10, 10]],
    [
      'a Node2D root with its own position and a flip h',
      cell(3, 1, 3 | TILE_TRANSFORM_FLIP_H),
      [309, 119, 10, 10],
    ],
  ] as const)('draws %s where Godot does', async (_name, placed, expected) => {
    expect(drawnBoxes(await render([placed]))).toEqual([expected]);
  });

  it.each([
    ['a scene id the source lacks', cell(0, 0, 15)],
    ['atlas coords other than (0, 0)', cell(0, 0, 1, { atlasCoords: { x: 1, y: 0 } })],
    ['a source the TileSet lacks', cell(0, 0, 1, { sourceId: 5 })],
  ])('draws no instance for %s', async (_name, placed) => {
    expect(drawnBoxes(await render([placed]))).toEqual([]);
  });

  it('draws no instance for a scene whose loaded root is a plain Node', async () => {
    // `set_scene_tile_scene` refuses a root that is no CanvasItem (`tile_set.cpp:5826-5827`).
    const { renderer } = await renderSceneTiles(layerScene(), {
      showGizmos: false,
      prepare: withCells([cell(0, 0, 7)]),
    });
    expect(drawnBoxes(renderer)).toEqual([]);
  });

  it('draws no instance for a scene that has not loaded', async () => {
    const { renderer } = await renderSceneTiles(layerScene(), {
      withheldScenes: ['res://polygon.tscn'],
      prepare: withCells([cell(0, 0, 1)]),
    });
    expect(drawnBoxes(renderer)).toEqual([]);
  });

  it('draws no instance on a disabled layer', async () => {
    expect(drawnBoxes(await render([cell(0, 0, 1)], 'enabled = false\n'))).toEqual([]);
  });

  it('draws a later instance over an earlier one', async () => {
    // The magenta tile comes first in the data and the yellow one second, yet cell order decides nothing.
    const renderer = await render([cell(0, 6, 5), cell(0, 5, 4)]);
    expect(boxesInPaintOrder(renderer)).toEqual([
      [117, 336, 30, 100],
      [122, 272, 20, 100],
    ]);
  });

  it('draws an instance over an authored child of the layer', async () => {
    const authored = `
[node name="Authored" type="Polygon2D" parent="Layer"]
color = Color(1, 1, 1, 1)
polygon = PackedVector2Array(64, 300, 114, 300, 114, 340, 64, 340)
`;
    const renderer = await render([cell(1, 5, 4)], '', authored);
    const order = boxesInPaintOrder(renderer);
    expect(order).toEqual([
      [164, 320, 50, 40],
      [186, 272, 20, 100],
    ]);
  });

  it('selects the layer on a click on an instance', async () => {
    const { renderer, probe } = await renderWithProbe([cell(0, 0, 1)]);
    const mesh = onlyMesh(renderer);
    expect(resolvePathFromObject(mesh, probe.selection!.objectPathMap)).toBe('Root/Layer');
  });

  it('lists no row for an instance in the Scene dock', async () => {
    const { probe } = await renderWithProbe([cell(0, 0, 1)]);
    expect(probe.livePaths).toEqual(['Root', 'Root/Layer']);
  });

  it('follows a change of the cell: the old instance goes and the new one appears', async () => {
    const { renderer, edit } = await renderWithProbe([cell(0, 0, 1)]);
    expect(drawnBoxes(renderer)).toEqual([[132, 52, 20, 10]]);

    await edit(layerScene(), withCells([cell(1, 0, 3)]));
    expect(drawnBoxes(renderer)).toEqual([[201, 55, 10, 10]]);
  });

  it('keeps the instance of an unchanged cell mounted when another cell changes', async () => {
    const { renderer, edit } = await renderWithProbe([cell(0, 0, 1), cell(1, 0, 3)]);
    const instanceAt132 = () => drawnMeshes(renderer).find(({ box }) => box[0] === 132)!.mesh;
    const before = instanceAt132();
    await edit(layerScene(), withCells([cell(0, 0, 1), cell(2, 0, 3)]));
    expect(instanceAt132()).toBe(before);
  });

  it('sorts an instance of a y-sorted layer with the layer children by the cell centre', async () => {
    const authored = `
[node name="Low" type="Polygon2D" parent="Layer"]
position = Vector2(0, 300)
polygon = PackedVector2Array(0, 0, 10, 0, 10, 10, 0, 10)

[node name="High" type="Polygon2D" parent="Layer"]
position = Vector2(0, 400)
polygon = PackedVector2Array(0, 0, 10, 0, 10, 10, 0, 10)
`;
    // The yellow tile's cell centre is at y 352 in the layer: between the two children.
    const renderer = await render([cell(0, 5, 4)], 'y_sort_enabled = true\n', authored);
    expect(boxesInPaintOrder(renderer)).toEqual([
      [100, 320, 10, 10],
      [122, 272, 20, 100],
      [100, 420, 10, 10],
    ]);
  });

  it('sorts an instance by its root offset: a root at y 80 draws over the one at the next cell', async () => {
    // Godot 4.6.3 sorts the roots, children of the layer, on their own y: 112 for the red one, 96 for the blue one.
    const renderer = await render([cell(0, 0, 8), cell(0, 1, 9)], 'y_sort_enabled = true\n');
    expect(boxesInPaintOrder(renderer)).toEqual([
      [132, 56, 30, 30],
      [132, 42, 30, 30],
    ]);
  });

  it('sorts an instance in the z bucket of its root: a raised root below a later child still draws over it', async () => {
    // The root's z_index of 1 puts it with the z 1 child, where the lower y of the child draws first.
    const authored = `
[node name="Raised" type="Polygon2D" parent="Layer"]
z_index = 1
position = Vector2(0, 300)
polygon = PackedVector2Array(0, 0, 10, 0, 10, 10, 0, 10)
`;
    const renderer = await render([cell(0, 6, 11)], 'y_sort_enabled = true\n', authored);
    expect(boxesInPaintOrder(renderer)).toEqual([
      [100, 320, 10, 10],
      [127, 431, 10, 10],
    ]);
  });

  it('sorts a Control root on the origin of its canvas item, pivot and rotation included', async () => {
    // The root turns about a pivot 40 px below it, so its item sits at y 32 - 5 + 80 = 107, below the child at 60.
    const authored = `
[node name="Mid" type="Polygon2D" parent="Layer"]
position = Vector2(0, 60)
polygon = PackedVector2Array(0, 0, 10, 0, 10, 10, 0, 10)
`;
    const renderer = await render([cell(0, 0, 13)], 'y_sort_enabled = true\n', authored);
    const order = boxesInPaintOrder(renderer);
    expect(order[0]).toEqual([100, 80, 10, 10]);
    expect(order).toHaveLength(2);
  });

  it('sorts a Control root on the origin its minimum size moves: growing upwards puts it before a child below it', async () => {
    // The root's top edge is at y 32 + 64, and its minimum height of 30 lifts it to y 32 + 36, above the child at 80.
    const authored = `
[node name="Low" type="Polygon2D" parent="Layer"]
position = Vector2(0, 80)
polygon = PackedVector2Array(0, 0, 10, 0, 10, 10, 0, 10)
`;
    const renderer = await render([cell(0, 0, 14)], 'y_sort_enabled = true\n', authored);
    expect(boxesInPaintOrder(renderer)).toEqual([
      [132, 88, 10, 30],
      [100, 100, 10, 10],
    ]);
  });

  it('keeps the draw order inside each of 400 instances', async () => {
    const stacked = Array.from({ length: 400 }, (_, i) => cell(i % 40, Math.floor(i / 40), 10));
    const widths = boxesInPaintOrder(await render(stacked)).map(([, , width]) => width);
    expect(widths.filter((width, i) => width !== [30, 20, 10][i % 3])).toEqual([]);
  });

  it('draws a Control root of a y-sorted layer at the cell', async () => {
    const renderer = await render([cell(0, 1, 2)], 'y_sort_enabled = true\n');
    expect(drawnBoxes(renderer)).toEqual([[127, 111, 10, 10]]);
  });
});
