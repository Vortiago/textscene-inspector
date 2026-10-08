/**
 * tileDrawInfo: from a drawable cell to the atlas pixel region, the draw orientation and where the
 * tile's centre sits, as `compute_transformed_tile_dest_rect` composes them.
 */
import { describe, it, expect } from 'vitest';
import {
  tileDrawInfo,
  TILE_TRANSFORM_FLIP_H,
  TILE_TRANSFORM_FLIP_V,
  TILE_TRANSFORM_TRANSPOSE,
  type AtlasSourceModel,
} from './types';
import { drawableCellOf } from './testing/drawableCellOf';

const source: AtlasSourceModel = {
  texturePath: 'res://t.png',
  margins: { x: 4, y: 6 },
  separation: { x: 2, y: 3 },
  textureRegionSize: { x: 16, y: 16 },
  tiles: new Map(),
};

const orientationOf = (alternativeId: number, tileFlips: { flipH?: boolean; flipV?: boolean } = {}) =>
  tileDrawInfo(source, drawableCellOf({ alternativeId }, tileFlips)).orientation;

describe('tileDrawInfo', () => {
  it('computes the atlas pixel region from margins, separation, and atlas coords', () => {
    const info = tileDrawInfo(source, drawableCellOf({ atlasCoords: { x: 2, y: 1 } }));
    expect(info.regionPx).toEqual({ x: 40, y: 25, width: 16, height: 16 });
  });

  it('spans size_in_atlas tiles and the separations between them', () => {
    const info = tileDrawInfo(source, drawableCellOf({ sizeInAtlas: { x: 2, y: 3 } }));
    expect(info.regionPx).toEqual({ x: 4, y: 6, width: 34, height: 54 });
  });

  it('reads the transform bits carried in the alternative id', () => {
    expect(orientationOf(TILE_TRANSFORM_FLIP_H)).toEqual({ flipH: true, flipV: false, transpose: false });
    expect(orientationOf(TILE_TRANSFORM_FLIP_V)).toEqual({ flipH: false, flipV: true, transpose: false });
    expect(orientationOf(TILE_TRANSFORM_TRANSPOSE | TILE_TRANSFORM_FLIP_H)).toEqual({
      flipH: true,
      flipV: false,
      transpose: true,
    });
  });

  it("cancels a painted flip against the tile's own", () => {
    expect(orientationOf(1 | TILE_TRANSFORM_FLIP_H, { flipH: true })).toEqual({
      flipH: false,
      flipV: false,
      transpose: false,
    });
  });

  it("moves the tile's own flips to the other axis under a painted transpose (tile_map_layer.cpp:2746-2747)", () => {
    expect(orientationOf(1 | TILE_TRANSFORM_TRANSPOSE, { flipH: true })).toEqual({
      flipH: false,
      flipV: true,
      transpose: true,
    });
  });

  it('centres the tile at the cell centre less its texture origin', () => {
    const info = tileDrawInfo(source, drawableCellOf({}, { textureOrigin: { x: 3, y: -5 } }));
    expect(info.centreOffset).toEqual({ x: -3, y: 5 });
  });

  it('mirrors the texture origin with a painted flip and swaps it with a painted transpose (:2764-2770)', () => {
    const tileData = { textureOrigin: { x: 3, y: -5 } };
    const flipped = drawableCellOf({ alternativeId: TILE_TRANSFORM_FLIP_H }, tileData);
    const transposed = drawableCellOf({ alternativeId: TILE_TRANSFORM_TRANSPOSE }, tileData);
    expect(tileDrawInfo(source, flipped).centreOffset).toEqual({ x: 3, y: 5 });
    expect(tileDrawInfo(source, transposed).centreOffset).toEqual({ x: 5, y: -3 });
  });
});
