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

describe('mapToLocalPx — unsupported shapes', () => {
  it('falls back to square placement with a warn (hexagon)', () => {
    const hex: TileGrid = { shape: 3, layout: 0, offsetAxis: 0, tileSize: { x: 128, y: 64 } };
    expect(mapToLocalPx(hex, { x: 1, y: 1 })).toEqual({ x: 192, y: 96 });
    expect(warnSpy).toHaveBeenCalled();
  });
});
