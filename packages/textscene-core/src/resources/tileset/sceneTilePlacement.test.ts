import { describe, it, expect } from 'vitest';
import { sceneTilePlacement } from './sceneTilePlacement';
import {
  TILE_TRANSFORM_FLIP_H,
  TILE_TRANSFORM_FLIP_V,
  TILE_TRANSFORM_TRANSPOSE,
  TileLayout,
  TileOffsetAxis,
  TileShape,
} from '../../godot/scene/tileSet';
import type { TileGrid } from './types';

const SQUARE: TileGrid = {
  shape: TileShape.TILE_SHAPE_SQUARE,
  layout: TileLayout.TILE_LAYOUT_STACKED,
  offsetAxis: TileOffsetAxis.TILE_OFFSET_AXIS_HORIZONTAL,
  tileSize: { x: 64, y: 64 },
};

const H = TILE_TRANSFORM_FLIP_H;
const V = TILE_TRANSFORM_FLIP_V;
const T = TILE_TRANSFORM_TRANSPOSE;

describe('sceneTilePlacement of a Node2D root', () => {
  // The axes of `_set_scene_transform_with_alternative` (`tile_map_layer.cpp:1706-1723`), worked by hand:
  // a transpose puts the horizontal axis in the second column.
  it.each([
    ['none', 0, { a: 1, b: 0, c: 0, d: 1 }],
    ['flip h', H, { a: -1, b: 0, c: 0, d: 1 }],
    ['flip v', V, { a: 1, b: 0, c: 0, d: -1 }],
    ['flip h and v', H | V, { a: -1, b: 0, c: 0, d: -1 }],
    ['transpose', T, { a: 0, b: 1, c: 1, d: 0 }],
    ['transpose and flip h', T | H, { a: 0, b: 1, c: -1, d: 0 }],
    ['transpose and flip v', T | V, { a: 0, b: -1, c: 1, d: 0 }],
    ['transpose, flip h and v', T | H | V, { a: 0, b: -1, c: -1, d: 0 }],
  ])('orients the axes for %s', (_name, alternativeId, axes) => {
    expect(sceneTilePlacement(SQUARE, { x: 2, y: 1 }, alternativeId, 'node2d')).toEqual({
      ...axes,
      tx: 160,
      ty: 96,
    });
  });

  it('reads the orientation from the alternative id with the scene id in its low bits', () => {
    const placed = sceneTilePlacement(SQUARE, { x: 0, y: 0 }, 3 | H, 'node2d');
    expect([placed.a, placed.d]).toEqual([-1, 1]);
  });
});

describe('sceneTilePlacement of a Control root', () => {
  it.each([0, H, V, T, H | V | T])(
    'only moves to the cell centre for orientation bits %i',
    (alternativeId) => {
      expect(sceneTilePlacement(SQUARE, { x: 2, y: 1 }, alternativeId, 'control')).toEqual({
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        tx: 160,
        ty: 96,
      });
    }
  );
});

describe('sceneTilePlacement on a grid that is not square', () => {
  it('takes the origin from map_to_local, as the layer places a tile', () => {
    // An odd row of a stacked half-offset grid sits half a cell to the right.
    const halfOffset: TileGrid = { ...SQUARE, shape: TileShape.TILE_SHAPE_HALF_OFFSET_SQUARE };
    const placed = sceneTilePlacement(halfOffset, { x: 1, y: 1 }, 0, 'node2d');
    expect([placed.tx, placed.ty]).toEqual([128, 96]);
  });
});
