import { describe, expect, it } from 'vitest';
import { layerQuadrants, renderingQuadrants } from './renderingQuadrants';
import type { TileSetModel } from './types';
import type { PlacedCell } from '../../nodes/2d/tiles/shared/tileData';

const SQUARE: TileSetModel = {
  shape: 0,
  layout: 0,
  offsetAxis: 0,
  tileSize: { x: 16, y: 16 },
  sources: new Map(),
};

function cell(x: number, y: number): PlacedCell {
  return { coords: { x, y }, sourceId: 0, atlasCoords: { x: 0, y: 0 }, alternativeId: 0 };
}

const coordsOf = (quadrants: readonly (readonly PlacedCell[])[]) =>
  quadrants.map((cells) => cells.map(({ coords }) => [coords.x, coords.y]));

describe('renderingQuadrants', () => {
  it('groups the cells of each quadrant_size square, rounding negative coords down', () => {
    const quadrants = renderingQuadrants([cell(0, 0), cell(1, 1), cell(-1, 0), cell(2, 0)], SQUARE, 2);
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
    const quadrants = renderingQuadrants([cell(0, 1), cell(0, 0), cell(1, 0)], SQUARE, 1);
    expect(coordsOf(quadrants)).toEqual([[[1, 0]], [[0, 0]], [[0, 1]]]);
  });

  it("orders the quadrants by map_to_local of their own coords, not of a cell's", () => {
    // Quadrant (0, 0) holds (15, 0), above (16, 5) in quadrant (1, 0), yet draws after it.
    const quadrants = renderingQuadrants([cell(15, 0), cell(16, 5)], SQUARE, 16);
    expect(coordsOf(quadrants)).toEqual([[[16, 5]], [[15, 0]]]);
  });

  it("sorts a quadrant's cells by x, then y", () => {
    const quadrants = renderingQuadrants([cell(1, 0), cell(0, 1), cell(0, 0)], SQUARE, 16);
    expect(coordsOf(quadrants)).toEqual([
      [
        [0, 0],
        [0, 1],
        [1, 0],
      ],
    ]);
  });

  it('returns no quadrant for no cells', () => {
    expect(renderingQuadrants([], SQUARE, 16)).toEqual([]);
  });
});

describe('layerQuadrants', () => {
  const cells = [cell(0, 0), cell(1, 0), cell(0, 1)];

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
    const row = [cell(2, 0), cell(0, 0), cell(1, 0)];
    const quadrants = layerQuadrants(row, SQUARE, { ySortEnabled: true, ySortOrigin: 0, quadrantSize: 16 });
    expect(coordsOf(quadrants)).toEqual([
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
    ]);
  });
});
