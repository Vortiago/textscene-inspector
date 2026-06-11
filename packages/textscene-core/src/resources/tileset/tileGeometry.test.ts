/**
 * Batched tile geometry builder — pure typed-array output (4 verts / 6 indices
 * per cell). Positions are three-local (Godot pixel space with Y negated once,
 * see node2dTransform); UVs follow the flipY=true convention (image-Y top-left
 * → UV-Y bottom-left), same as spriteFrame.ts.
 */
import { describe, it, expect } from 'vitest';
import { buildTileGeometryArrays } from './tileGeometry';
import { TILE_SHAPE_SQUARE, type AtlasSourceModel, type TileGrid } from './tileSetModel';
import type { PlacedCell } from '../../nodes/2d/tiles/shared/tileData';

const grid: TileGrid = {
  shape: TILE_SHAPE_SQUARE,
  layout: 0,
  offsetAxis: 0,
  tileSize: { x: 16, y: 16 },
};

const source: AtlasSourceModel = {
  texturePath: 'res://tiles.png',
  margins: { x: 0, y: 0 },
  separation: { x: 0, y: 0 },
  textureRegionSize: { x: 16, y: 16 },
  tiles: new Map(),
};

const cell = (x: number, y: number, ax = 0, ay = 0): PlacedCell => ({
  coords: { x, y },
  sourceId: 0,
  atlasCoords: { x: ax, y: ay },
  alternativeId: 0,
});

describe('buildTileGeometryArrays', () => {
  it('builds one quad centered on the cell with Y negated and UVs windowed to the atlas region', () => {
    // Cell (0,0) on a 16px grid → Godot center (8,8) → quad spans x 0..16, y(three) -16..0.
    // Atlas region (0,0,16,16) of a 32×32 texture → u 0..0.5, v 0.5..1 (flipY).
    const { positions, uvs, indices } = buildTileGeometryArrays([cell(0, 0)], source, grid, 32, 32);

    expect(Array.from(positions)).toEqual([
      0, 0, 0, // TL
      16, 0, 0, // TR
      0, -16, 0, // BL
      16, -16, 0, // BR
    ]);
    expect(Array.from(uvs)).toEqual([
      0, 1, // TL
      0.5, 1, // TR
      0, 0.5, // BL
      0.5, 0.5, // BR
    ]);
    expect(Array.from(indices)).toEqual([2, 3, 0, 3, 1, 0]);
  });
});
