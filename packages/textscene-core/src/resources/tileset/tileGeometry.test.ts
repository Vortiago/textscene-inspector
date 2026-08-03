/**
 * Batched tile geometry builder — pure typed-array output (4 verts / 6 indices
 * per cell). Positions are three-local (Godot pixel space with Y negated once,
 * see node2dTransform); UVs follow the flipY=true convention (image-Y top-left
 * → UV-Y bottom-left), same as spriteFrame.ts.
 */
import { describe, it, expect } from 'vitest';
import { buildTileGeometryArrays } from './tileGeometry';
import { TILE_SHAPE_SQUARE, type AtlasSourceModel, type TileGrid } from './types';
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

  describe('orientation (asymmetric 16×8 region of a 32×32 texture)', () => {
    // Base corner grid: TL(0,1) TR(0.5,1) BL(0,0.75) BR(0.5,0.75).
    const thin: AtlasSourceModel = { ...source, textureRegionSize: { x: 16, y: 8 } };
    const FLIP_H = 0x1000;
    const FLIP_V = 0x2000;
    const TRANSPOSE = 0x4000;

    function uvsFor(alternativeId: number): number[] {
      const { uvs } = buildTileGeometryArrays(
        [{ ...cell(0, 0), alternativeId }],
        thin,
        grid,
        32,
        32
      );
      return Array.from(uvs);
    }

    it('flip_h mirrors the U axis (swaps grid columns)', () => {
      expect(uvsFor(FLIP_H)).toEqual([0.5, 1, 0, 1, 0.5, 0.75, 0, 0.75]);
    });

    it('flip_v mirrors the V axis (swaps grid rows)', () => {
      expect(uvsFor(FLIP_V)).toEqual([0, 0.75, 0.5, 0.75, 0, 1, 0.5, 1]);
    });

    it('transpose reflects across the main diagonal and swaps the quad size', () => {
      const { positions, uvs } = buildTileGeometryArrays(
        [{ ...cell(0, 0), alternativeId: TRANSPOSE }],
        thin,
        grid,
        32,
        32
      );
      expect(Array.from(uvs)).toEqual([0, 1, 0, 0.75, 0.5, 1, 0.5, 0.75]);
      // Quad drawn (h, w) = 8×16 around center (8, -8).
      expect(Array.from(positions)).toEqual([4, 0, 0, 12, 0, 0, 4, -16, 0, 12, -16, 0]);
    });

    it('composes transpose then flips (90° CW = transpose + flip_h; triple combo)', () => {
      expect(uvsFor(TRANSPOSE | FLIP_H)).toEqual([0, 0.75, 0, 1, 0.5, 0.75, 0.5, 1]);
      expect(uvsFor(TRANSPOSE | FLIP_H | FLIP_V)).toEqual([0.5, 0.75, 0.5, 1, 0, 0.75, 0, 1]);
    });
  });

  it('shifts the quad by the tile texture_origin (Godot: dest = map_to_local − size/2 − origin)', () => {
    const anchored: AtlasSourceModel = {
      ...source,
      tiles: new Map([
        [
          '0:0',
          {
            sizeInAtlas: { x: 1, y: 1 },
            alternatives: new Map([
              [0, { flipH: false, flipV: false, transpose: false, textureOrigin: { x: 0, y: -16 } }],
            ]),
          },
        ],
      ]),
    };
    // center (8,8) − origin (0,−16) = (8, 24) → three-local y −16..−32.
    const { positions } = buildTileGeometryArrays([cell(0, 0)], anchored, grid, 32, 32);
    expect(Array.from(positions)).toEqual([0, -16, 0, 16, -16, 0, 0, -32, 0, 16, -32, 0]);
  });

  it('windows UVs through margins, separation, and atlas coordinates', () => {
    const spaced: AtlasSourceModel = {
      ...source,
      margins: { x: 4, y: 6 },
      separation: { x: 2, y: 3 },
    };
    // regionPx = (4 + 2·18, 6 + 1·19, 16, 16) = (40, 25, 16, 16) of a 64×64 texture.
    const { uvs } = buildTileGeometryArrays([cell(0, 0, 2, 1)], spaced, grid, 64, 64);
    expect(Array.from(uvs)).toEqual([
      0.625, 0.609375, // TL
      0.875, 0.609375, // TR
      0.625, 0.359375, // BL
      0.875, 0.359375, // BR
    ]);
  });
});
