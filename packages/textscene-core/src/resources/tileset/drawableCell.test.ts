/** Godot draws a placed cell only when its source, tile and alternative exist (`tile_map_layer.cpp:527-531`). */
import { describe, expect, it } from 'vitest';
import { drawableCells } from './drawableCell';
import type { PlacedCell } from '../../nodes/2d/tiles/shared/tileData';
import { defaultTileData, type AtlasSourceModel } from './types';

/** Source 1 holds tile (0, 0) with alternatives 0 and 1, alternative 1 at z_index 5. */
const SOURCE: AtlasSourceModel = {
  texturePath: 'res://tiles.png',
  margins: { x: 0, y: 0 },
  separation: { x: 0, y: 0 },
  textureRegionSize: { x: 16, y: 16 },
  tiles: new Map([
    [
      '0:0',
      {
        sizeInAtlas: { x: 1, y: 1 },
        alternatives: new Map([
          [0, defaultTileData()],
          [1, { ...defaultTileData(), zIndex: 5 }],
        ]),
      },
    ],
  ]),
};
const MODEL = { sources: new Map([[1, SOURCE]]) };

function cell(x: number, sourceId = 1, alternativeId = 0): PlacedCell {
  return { coords: { x, y: 0 }, sourceId, atlasCoords: { x: 0, y: 0 }, alternativeId };
}

describe('drawableCells', () => {
  it('hands each cell the source, tile and TileData it names', () => {
    const [drawn] = drawableCells(MODEL, [cell(0)]);
    expect(drawn!.source).toBe(SOURCE);
    expect(drawn!.tile).toBe(SOURCE.tiles.get('0:0'));
    expect(drawn!.tileData).toBe(SOURCE.tiles.get('0:0')!.alternatives.get(0));
  });

  it('looks up the alternative with its transform bits cleared', () => {
    const [drawn] = drawableCells(MODEL, [cell(0, 1, 1 | 0x1000)]);
    expect(drawn!.tileData.zIndex).toBe(5);
    expect(drawn!.alternativeId).toBe(1 | 0x1000);
  });

  it('drops a cell whose source, tile or alternative the tileset lacks, keeping the order of the rest', () => {
    const missingTile = { ...cell(3), atlasCoords: { x: 7, y: 7 } };
    const drawn = drawableCells(MODEL, [cell(0), cell(1, 9), cell(2, 1, 4), missingTile, cell(4)]);
    expect(drawn.map((c) => c.coords.x)).toEqual([0, 4]);
  });

  it('returns no cell for no cells', () => {
    expect(drawableCells(MODEL, [])).toEqual([]);
  });
});
