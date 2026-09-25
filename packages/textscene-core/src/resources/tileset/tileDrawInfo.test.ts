/**
 * tileDrawInfo: from atlas coords and alternative id to the atlas pixel region, the draw
 * orientation and the texture origin the geometry builder needs.
 */
import { describe, it, expect } from 'vitest';
import {
  tileDrawInfo,
  TILE_TRANSFORM_FLIP_H,
  TILE_TRANSFORM_FLIP_V,
  TILE_TRANSFORM_TRANSPOSE,
  type AtlasSourceModel,
} from './types';

const source: AtlasSourceModel = {
  texturePath: 'res://t.png',
  margins: { x: 4, y: 6 },
  separation: { x: 2, y: 3 },
  textureRegionSize: { x: 16, y: 16 },
  tiles: new Map(),
};

describe('tileDrawInfo', () => {
  it('computes the atlas pixel region from margins, separation, and atlas coords', () => {
    const info = tileDrawInfo(source, { x: 2, y: 1 }, 0);
    expect(info.regionPx).toEqual({ x: 40, y: 25, width: 16, height: 16 });
    expect(info.orientation).toEqual({ flipH: false, flipV: false, transpose: false });
    expect(info.textureOrigin).toEqual({ x: 0, y: 0 });
  });

  it('reads the transform bits carried in the alternative id', () => {
    expect(tileDrawInfo(source, { x: 0, y: 0 }, TILE_TRANSFORM_FLIP_H).orientation).toEqual({
      flipH: true,
      flipV: false,
      transpose: false,
    });
    expect(tileDrawInfo(source, { x: 0, y: 0 }, TILE_TRANSFORM_FLIP_V).orientation).toEqual({
      flipH: false,
      flipV: true,
      transpose: false,
    });
    expect(
      tileDrawInfo(source, { x: 0, y: 0 }, TILE_TRANSFORM_TRANSPOSE | TILE_TRANSFORM_FLIP_H)
        .orientation
    ).toEqual({ flipH: true, flipV: false, transpose: true });
  });

  it('XORs painted transform bits over the authored alternative flags', () => {
    const authored: AtlasSourceModel = {
      ...source,
      tiles: new Map([
        [
          '0:0',
          {
            sizeInAtlas: { x: 1, y: 1 },
            alternatives: new Map([
              [1, { flipH: true, flipV: false, transpose: false, textureOrigin: { x: 0, y: 0 } }],
            ]),
          },
        ],
      ]),
    };
    // Painted FLIP_H over an alternative that is already flipped → cancels out.
    const info = tileDrawInfo(authored, { x: 0, y: 0 }, 1 | TILE_TRANSFORM_FLIP_H);
    expect(info.orientation).toEqual({ flipH: false, flipV: false, transpose: false });
  });
});
