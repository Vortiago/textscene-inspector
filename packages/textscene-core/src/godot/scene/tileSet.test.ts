import { describe, it, expect } from 'vitest';
import { TILE_LAYOUT_NAMES, TILE_OFFSET_AXIS_NAMES, TILE_SHAPE_NAMES } from './tileSet.js';

/** `TileSet`'s enums (`scene/resources/2d/tile_set.h:244-263`). */
describe('TileSet enum names', () => {
  it('names the four tile shapes', () => {
    expect(TILE_SHAPE_NAMES).toEqual({
      0: 'TILE_SHAPE_SQUARE',
      1: 'TILE_SHAPE_ISOMETRIC',
      2: 'TILE_SHAPE_HALF_OFFSET_SQUARE',
      3: 'TILE_SHAPE_HEXAGON',
    });
  });

  it('names the six half-offset layouts', () => {
    expect(TILE_LAYOUT_NAMES).toEqual({
      0: 'TILE_LAYOUT_STACKED',
      1: 'TILE_LAYOUT_STACKED_OFFSET',
      2: 'TILE_LAYOUT_STAIRS_RIGHT',
      3: 'TILE_LAYOUT_STAIRS_DOWN',
      4: 'TILE_LAYOUT_DIAMOND_RIGHT',
      5: 'TILE_LAYOUT_DIAMOND_DOWN',
    });
  });

  it('names the two offset axes', () => {
    expect(TILE_OFFSET_AXIS_NAMES).toEqual({
      0: 'TILE_OFFSET_AXIS_HORIZONTAL',
      1: 'TILE_OFFSET_AXIS_VERTICAL',
    });
  });
});
