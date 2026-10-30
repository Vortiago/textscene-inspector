import { describe, expect, it } from 'vitest';
import { layerQuadrants } from './renderingQuadrants';
import { defaultTileData, type TileSetModel } from './types';
import type { PlacedCell } from '../../nodes/2d/tiles/shared/tileData';
import { tileTextureAt } from './testing/tileTexture';

/** A square 16 px tileset whose source 0 holds tile (0, 0). */
const SQUARE: TileSetModel = {
  shape: 0,
  layout: 0,
  offsetAxis: 0,
  tileSize: { x: 16, y: 16 },
  sources: new Map([
    [
      0,
      {
        texture: tileTextureAt('res://tiles.png'),
        margins: { x: 0, y: 0 },
        separation: { x: 0, y: 0 },
        textureRegionSize: { x: 16, y: 16 },
        usesTexturePadding: false,
        tiles: new Map([
          ['0:0', { sizeInAtlas: { x: 1, y: 1 }, alternatives: new Map([[0, defaultTileData()]]) }],
        ]),
      },
    ],
  ]),
};

function placed(x: number, y: number, sourceId = 0): PlacedCell {
  return { coords: { x, y }, sourceId, atlasCoords: { x: 0, y: 0 }, alternativeId: 0 };
}

const coordsOf = (quadrants: readonly (readonly PlacedCell[])[]) =>
  quadrants.map((cells) => cells.map(({ coords }) => [coords.x, coords.y]));

/** The rendering quadrants of a layer that is not y-sorted. */
function quadrantsOf(cells: readonly PlacedCell[], quadrantSize: number) {
  return layerQuadrants(cells, SQUARE, { ySortEnabled: false, ySortOrigin: 0, quadrantSize });
}

describe('the rendering quadrants of a layer that is not y-sorted', () => {
  it('groups the cells of each quadrant_size square, rounding negative coords down', () => {
    const quadrants = quadrantsOf([placed(0, 0), placed(1, 1), placed(-1, 0), placed(2, 0)], 2);
    expect(coordsOf(quadrants)).toEqual([
      [[2, 0]],
      [
        [0, 0],
        [1, 1],
      ],
      [[-1, 0]],
    ]);
  });

  it('orders the quadrants by local y, then by local x from right to left', () => {
    const quadrants = quadrantsOf([placed(0, 1), placed(0, 0), placed(1, 0)], 1);
    expect(coordsOf(quadrants)).toEqual([[[1, 0]], [[0, 0]], [[0, 1]]]);
  });

  it("orders the quadrants by map_to_local of their own coords, not of a cell's", () => {
    // Quadrant (0, 0) holds (15, 0), above (16, 5) in quadrant (1, 0), yet draws after it.
    const quadrants = quadrantsOf([placed(15, 0), placed(16, 5)], 16);
    expect(coordsOf(quadrants)).toEqual([[[16, 5]], [[15, 0]]]);
  });

  it("sorts a quadrant's cells by x, then y", () => {
    const quadrants = quadrantsOf([placed(1, 0), placed(0, 1), placed(0, 0)], 16);
    expect(coordsOf(quadrants)).toEqual([
      [
        [0, 0],
        [0, 1],
        [1, 0],
      ],
    ]);
  });

  it('returns no quadrant for no cells', () => {
    expect(quadrantsOf([], 16)).toEqual([]);
  });
});

describe('layerQuadrants', () => {
  const cells = [placed(0, 0), placed(1, 0), placed(0, 1)];

  it('splits a layer that is not y-sorted into rendering quadrants', () => {
    const quadrants = layerQuadrants(cells, SQUARE, {
      ySortEnabled: false,
      ySortOrigin: 0,
      quadrantSize: 16,
    });
    expect(quadrants).toHaveLength(1);
  });

  it('draws a y-sorted layer one tile row per quadrant (tile_map_layer.cpp:546-548)', () => {
    const quadrants = layerQuadrants(cells, SQUARE, { ySortEnabled: true, ySortOrigin: 0, quadrantSize: 16 });
    expect(coordsOf(quadrants)).toEqual([
      [
        [0, 0],
        [1, 0],
      ],
      [[0, 1]],
    ]);
  });
  it("sorts a y-sorted row's cells by x, as every quadrant's", () => {
    const row = [placed(2, 0), placed(0, 0), placed(1, 0)];
    const quadrants = layerQuadrants(row, SQUARE, { ySortEnabled: true, ySortOrigin: 0, quadrantSize: 16 });
    expect(coordsOf(quadrants)).toEqual([
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
    ]);
  });

  it('places a cell the tileset cannot draw in no quadrant (tile_map_layer.cpp:527-531)', () => {
    for (const ySortEnabled of [false, true]) {
      const quadrants = layerQuadrants([placed(0, 0), placed(0, 5, 9)], SQUARE, {
        ySortEnabled,
        ySortOrigin: 0,
        quadrantSize: 1,
      });
      expect(coordsOf(quadrants)).toEqual([[[0, 0]]]);
    }
  });
});
