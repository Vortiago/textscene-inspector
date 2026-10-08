/**
 * A rendering quadrant is one or more canvas items: Godot starts a new one at each change of tile
 * material or `z_index` in the quadrant's cell order, and batches each item's cells into runs of
 * one atlas source.
 */
import { describe, expect, it } from 'vitest';
import { quadrantCanvasItems, type TileCanvasItem } from './tileCanvasItems';
import type { PlacedCell } from '../../nodes/2d/tiles/shared/tileData';
import type { AlternativeTileModel, AtlasSourceModel, TileMaterial, TileSetModel } from './types';

const BASE_TILE_DATA: AlternativeTileModel = {
  flipH: false,
  flipV: false,
  transpose: false,
  textureOrigin: { x: 0, y: 0 },
  modulate: { r: 1, g: 1, b: 1, a: 1 },
  material: null,
  zIndex: 0,
  ySortOrigin: 0,
};

const ADD: TileMaterial = { properties: null };
const SUB: TileMaterial = { properties: null };

/** Alternative ids 0..n of tile (0, 0), each with its own TileData. */
function atlasSource(id: number, alternatives: Partial<AlternativeTileModel>[] = [{}]): AtlasSourceModel {
  return {
    texturePath: `res://source${id}.png`,
    margins: { x: 0, y: 0 },
    separation: { x: 0, y: 0 },
    textureRegionSize: { x: 16, y: 16 },
    tiles: new Map([
      [
        '0:0',
        {
          sizeInAtlas: { x: 1, y: 1 },
          alternatives: new Map(alternatives.map((data, altId) => [altId, { ...BASE_TILE_DATA, ...data }])),
        },
      ],
    ]),
  };
}

function tileSet(sources: [number, AtlasSourceModel][]): TileSetModel {
  return { shape: 0, layout: 0, offsetAxis: 0, tileSize: { x: 16, y: 16 }, sources: new Map(sources) };
}

function cell(x: number, sourceId = 0, alternativeId = 0): PlacedCell {
  return { coords: { x, y: 0 }, sourceId, atlasCoords: { x: 0, y: 0 }, alternativeId };
}

/** Each item's runs as [sourceId, cell x coords]. */
const runsOf = (items: readonly TileCanvasItem[]) =>
  items.map((item) => item.runs.map((run) => [run.sourceId, run.cells.map((c) => c.coords.x)]));

describe('quadrantCanvasItems', () => {
  it('draws a quadrant whose tiles share material and z_index as one canvas item', () => {
    const items = quadrantCanvasItems(tileSet([[0, atlasSource(0)]]), [cell(0), cell(1)]);
    expect(runsOf(items)).toEqual([[[0, [0, 1]]]]);
  });

  it('starts a canvas item at each change of z_index, in cell order', () => {
    const model = tileSet([[0, atlasSource(0, [{}, { zIndex: 2 }])]]);
    const items = quadrantCanvasItems(model, [cell(0), cell(1, 0, 1), cell(2)]);
    expect(items.map((item) => item.zIndex)).toEqual([0, 2, 0]);
    expect(runsOf(items)).toEqual([[[0, [0]]], [[0, [1]]], [[0, [2]]]]);
  });

  it('starts a canvas item at each change of material, and keeps one item for one shared material', () => {
    const model = tileSet([
      [0, atlasSource(0, [{}, { material: ADD }, { material: ADD }, { material: SUB }])],
    ]);
    const items = quadrantCanvasItems(model, [cell(0), cell(1, 0, 1), cell(2, 0, 2), cell(3, 0, 3)]);
    expect(items.map((item) => item.material)).toEqual([null, ADD, SUB]);
    expect(runsOf(items)).toEqual([[[0, [0]]], [[0, [1, 2]]], [[0, [3]]]]);
  });

  it('starts a batch at each change of source inside one canvas item', () => {
    const model = tileSet([
      [0, atlasSource(0)],
      [1, atlasSource(1)],
    ]);
    const items = quadrantCanvasItems(model, [cell(0), cell(1, 1), cell(2), cell(3)]);
    expect(runsOf(items)).toEqual([
      [
        [0, [0]],
        [1, [1]],
        [0, [2, 3]],
      ],
    ]);
  });

  it("hands each batch its source's atlas", () => {
    const source = atlasSource(4);
    expect(quadrantCanvasItems(tileSet([[4, source]]), [cell(0, 4)])[0]!.runs[0]!.source).toBe(source);
  });

  it('hands each cell the TileData of its alternative, its transform bits cleared', () => {
    const model = tileSet([[0, atlasSource(0, [{}, { zIndex: 5 }])]]);
    const [item] = quadrantCanvasItems(model, [cell(0, 0, 1 | 0x1000)]);
    expect(item!.runs[0]!.cells[0]!.tileData.zIndex).toBe(5);
  });

  it('drops a cell whose source, tile or alternative the tileset lacks, joining the runs around it', () => {
    const model = tileSet([[1, atlasSource(1)]]);
    const missingTile = { ...cell(3, 1), atlasCoords: { x: 7, y: 7 } };
    const cells = [cell(0, 1), cell(1, 9), cell(2, 1, 4), missingTile, cell(4, 1)];
    expect(runsOf(quadrantCanvasItems(model, cells))).toEqual([[[1, [0, 4]]]]);
  });

  it('keeps a z_index the RenderingServer refuses at 0, though it still starts an item', () => {
    // `canvas_item_set_z_index` refuses one outside ±4096 (renderer_canvas_cull.cpp:1841).
    const model = tileSet([[0, atlasSource(0, [{}, { zIndex: 5000 }])]]);
    const items = quadrantCanvasItems(model, [cell(0), cell(1, 0, 1)]);
    expect(items.map((item) => item.zIndex)).toEqual([0, 0]);
  });

  it('returns no canvas item for no cells', () => {
    expect(quadrantCanvasItems(tileSet([[0, atlasSource(0)]]), [])).toEqual([]);
  });
});
