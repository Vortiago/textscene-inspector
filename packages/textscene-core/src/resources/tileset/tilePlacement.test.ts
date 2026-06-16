/**
 * Cell-placement math — Godot's map_to_local: grid coords → the CENTER of the
 * cell in local pixels (Godot 2D space, +Y down). Isometric expectations are
 * hand-computed from the verbatim TileSet::map_to_local switch (tile_set.cpp).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as logger from '../../logger';
import { mapToLocalPx } from './tilePlacement';
import { TILE_SHAPE_ISOMETRIC, TILE_SHAPE_SQUARE, type TileGrid } from './tileSetModel';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

const squareGrid: TileGrid = {
  shape: TILE_SHAPE_SQUARE,
  layout: 0,
  offsetAxis: 0,
  tileSize: { x: 16, y: 16 },
};

function isoGrid(layout: TileGrid['layout'], offsetAxis: 0 | 1 = 0): TileGrid {
  return { shape: TILE_SHAPE_ISOMETRIC, layout, offsetAxis, tileSize: { x: 128, y: 64 } };
}

describe('mapToLocalPx — square', () => {
  it('returns the cell center: (cell + 0.5) × tileSize', () => {
    expect(mapToLocalPx(squareGrid, { x: 2, y: 3 })).toEqual({ x: 40, y: 56 });
  });
});

describe('mapToLocalPx — isometric (horizontal offset axis, 128×64)', () => {
  it('DIAMOND_DOWN (the dungeon layout), including negative coords', () => {
    const g = isoGrid(5);
    expect(mapToLocalPx(g, { x: 0, y: 0 })).toEqual({ x: 64, y: 32 });
    expect(mapToLocalPx(g, { x: 1, y: 0 })).toEqual({ x: 128, y: 64 });
    expect(mapToLocalPx(g, { x: 0, y: 1 })).toEqual({ x: 0, y: 64 });
    expect(mapToLocalPx(g, { x: 2, y: 1 })).toEqual({ x: 128, y: 128 });
    expect(mapToLocalPx(g, { x: -1, y: -2 })).toEqual({ x: 128, y: -64 });
  });

  it('STACKED staggers odd rows half a tile (posmod handles negative rows)', () => {
    const g = isoGrid(0);
    expect(mapToLocalPx(g, { x: 0, y: 0 })).toEqual({ x: 64, y: 32 });
    expect(mapToLocalPx(g, { x: 1, y: 0 })).toEqual({ x: 192, y: 32 });
    expect(mapToLocalPx(g, { x: 0, y: 1 })).toEqual({ x: 128, y: 64 });
    expect(mapToLocalPx(g, { x: 0, y: -1 })).toEqual({ x: 128, y: 0 });
    expect(mapToLocalPx(g, { x: 0, y: 2 })).toEqual({ x: 64, y: 96 });
  });

  it('STACKED_OFFSET staggers even rows instead', () => {
    expect(mapToLocalPx(isoGrid(1), { x: 0, y: 1 })).toEqual({ x: 64, y: 64 });
    expect(mapToLocalPx(isoGrid(1), { x: 0, y: 0 })).toEqual({ x: 128, y: 32 });
  });

  it('STAIRS_RIGHT, STAIRS_DOWN, DIAMOND_RIGHT match the transcribed arms', () => {
    expect(mapToLocalPx(isoGrid(2), { x: 1, y: 1 })).toEqual({ x: 256, y: 64 });
    expect(mapToLocalPx(isoGrid(3), { x: 1, y: 1 })).toEqual({ x: 128, y: 128 });
    expect(mapToLocalPx(isoGrid(4), { x: 1, y: 0 })).toEqual({ x: 128, y: 0 });
  });
});

describe('mapToLocalPx — vertical offset axis', () => {
  it('STACKED staggers odd columns and halves x instead of y', () => {
    expect(mapToLocalPx(isoGrid(0, 1), { x: 1, y: 0 })).toEqual({ x: 128, y: 64 });
    expect(mapToLocalPx(isoGrid(0, 1), { x: 0, y: 0 })).toEqual({ x: 64, y: 32 });
  });
});

describe('mapToLocalPx — hexagon (the hexagonal_map demo: vertical axis, 110×94)', () => {
  function hexGrid(layout: TileGrid['layout'], offsetAxis: 0 | 1): TileGrid {
    return { shape: 3, layout, offsetAxis, tileSize: { x: 110, y: 94 } };
  }

  it('STACKED, vertical axis: odd columns offset half a tile, x compressed to 0.75', () => {
    const g = hexGrid(0, 1);
    expect(mapToLocalPx(g, { x: 0, y: 0 })).toEqual({ x: 55, y: 47 });
    expect(mapToLocalPx(g, { x: 1, y: 0 })).toEqual({ x: 137.5, y: 94 });
    expect(mapToLocalPx(g, { x: 2, y: 0 })).toEqual({ x: 220, y: 47 });
    expect(mapToLocalPx(g, { x: 0, y: 1 })).toEqual({ x: 55, y: 141 });
  });

  it('STACKED, horizontal axis: odd rows offset, y compressed to 0.75 instead', () => {
    const g = hexGrid(0, 0);
    expect(mapToLocalPx(g, { x: 0, y: 0 })).toEqual({ x: 55, y: 47 });
    expect(mapToLocalPx(g, { x: 0, y: 1 })).toEqual({ x: 110, y: 117.5 });
    expect(mapToLocalPx(g, { x: 1, y: 1 })).toEqual({ x: 220, y: 117.5 });
  });

  // All six layouts, vertical axis, at cell (3, 2) (odd column ⇒ y staggered).
  // Each expected value is hand-computed from Godot's TileSet::map_to_local
  // switch, then ret.x *= 0.75 (hexagon overlap), then (ret + 0.5) × {110, 94}.
  it.each<[string, TileGrid['layout'], { x: number; y: number }]>([
    ['STACKED', 0, { x: 302.5, y: 282 }],
    ['STACKED_OFFSET', 1, { x: 302.5, y: 235 }],
    ['STAIRS_RIGHT', 2, { x: 715, y: 141 }],
    ['STAIRS_DOWN', 3, { x: 302.5, y: 376 }],
    ['DIAMOND_RIGHT', 4, { x: 467.5, y: 0 }],
    ['DIAMOND_DOWN', 5, { x: 137.5, y: 282 }],
  ])('vertical axis %s places cell (3, 2) at the Godot center', (_name, layout, expected) => {
    expect(mapToLocalPx(hexGrid(layout, 1), { x: 3, y: 2 })).toEqual(expected);
  });

  // All six layouts, horizontal axis, at cell (2, 3) (odd row ⇒ x staggered);
  // ret.y *= 0.75, then (ret + 0.5) × {110, 94}.
  it.each<[string, TileGrid['layout'], { x: number; y: number }]>([
    ['STACKED', 0, { x: 330, y: 258.5 }],
    ['STACKED_OFFSET', 1, { x: 275, y: 258.5 }],
    ['STAIRS_RIGHT', 2, { x: 440, y: 258.5 }],
    ['STAIRS_DOWN', 3, { x: 165, y: 611 }],
    ['DIAMOND_RIGHT', 4, { x: 330, y: 117.5 }],
    ['DIAMOND_DOWN', 5, { x: 0, y: 399.5 }],
  ])('horizontal axis %s places cell (2, 3) at the Godot center', (_name, layout, expected) => {
    expect(mapToLocalPx(hexGrid(layout, 0), { x: 2, y: 3 })).toEqual(expected);
  });
});

describe('mapToLocalPx — half-offset square (staggered, ratio 1.0)', () => {
  function halfGrid(layout: TileGrid['layout'], offsetAxis: 0 | 1): TileGrid {
    return { shape: 2, layout, offsetAxis, tileSize: { x: 16, y: 16 } };
  }

  it('STACKED, horizontal axis: odd rows offset half a tile, no overlap compression', () => {
    const g = halfGrid(0, 0);
    expect(mapToLocalPx(g, { x: 0, y: 0 })).toEqual({ x: 8, y: 8 });
    expect(mapToLocalPx(g, { x: 1, y: 0 })).toEqual({ x: 24, y: 8 });
    expect(mapToLocalPx(g, { x: 0, y: 1 })).toEqual({ x: 16, y: 24 });
  });

  it('STACKED, vertical axis: odd columns offset half a tile, no overlap compression', () => {
    const g = halfGrid(0, 1);
    expect(mapToLocalPx(g, { x: 0, y: 1 })).toEqual({ x: 8, y: 24 });
    expect(mapToLocalPx(g, { x: 1, y: 0 })).toEqual({ x: 24, y: 16 });
  });

  // All six layouts, horizontal axis, cell (2, 3); same Godot switch as hexagon
  // but ratio 1.0 (stagger, no overlap), then (ret + 0.5) × {16, 16}.
  it.each<[string, TileGrid['layout'], { x: number; y: number }]>([
    ['STACKED', 0, { x: 48, y: 56 }],
    ['STACKED_OFFSET', 1, { x: 40, y: 56 }],
    ['STAIRS_RIGHT', 2, { x: 64, y: 56 }],
    ['STAIRS_DOWN', 3, { x: 24, y: 136 }],
    ['DIAMOND_RIGHT', 4, { x: 48, y: 24 }],
    ['DIAMOND_DOWN', 5, { x: 0, y: 88 }],
  ])('horizontal axis %s places cell (2, 3) at the Godot center', (_name, layout, expected) => {
    expect(mapToLocalPx(halfGrid(layout, 0), { x: 2, y: 3 })).toEqual(expected);
  });

  // All six layouts, vertical axis, cell (3, 2).
  it.each<[string, TileGrid['layout'], { x: number; y: number }]>([
    ['STACKED', 0, { x: 56, y: 48 }],
    ['STACKED_OFFSET', 1, { x: 56, y: 40 }],
    ['STAIRS_RIGHT', 2, { x: 136, y: 24 }],
    ['STAIRS_DOWN', 3, { x: 56, y: 64 }],
    ['DIAMOND_RIGHT', 4, { x: 88, y: 0 }],
    ['DIAMOND_DOWN', 5, { x: 24, y: 48 }],
  ])('vertical axis %s places cell (3, 2) at the Godot center', (_name, layout, expected) => {
    expect(mapToLocalPx(halfGrid(layout, 1), { x: 3, y: 2 })).toEqual(expected);
  });
});

describe('mapToLocalPx — unknown shapes fall back to square (resolver warns once)', () => {
  it('an unrecognized tile_shape places on the plain square grid, never staggered', () => {
    const odd: TileGrid = { shape: 99, layout: 0, offsetAxis: 0, tileSize: { x: 16, y: 16 } };
    expect(mapToLocalPx(odd, { x: 1, y: 1 })).toEqual({ x: 24, y: 24 });
    expect(warnSpy).not.toHaveBeenCalled(); // per-cell warns would flood; the resolver warns
  });
});
