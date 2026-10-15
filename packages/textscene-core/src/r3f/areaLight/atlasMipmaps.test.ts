import { describe, expect, it } from 'vitest';
import { areaTextureMipmaps, mipSize } from './atlasMipmaps';
import { AREA_LIGHT_ATLAS_MIPMAPS } from '../../godot/rendering/lights/areaLightAtlas';

describe('mipSize', () => {
  it('halves the side once per level', () => {
    expect([0, 1, 2].map((level) => mipSize(256, level))).toEqual([256, 128, 64]);
  });

  it('stops at one texel past the last halving (edge case)', () => {
    expect(mipSize(256, 12)).toBe(1);
  });

  it('keeps an empty side at one texel (error case)', () => {
    expect(mipSize(0, 0)).toBe(1);
  });
});

describe('areaTextureMipmaps', () => {
  it('fills every mip of the placed texture', () => {
    const image = { width: 128, height: 128, data: new Uint8Array(128 * 128 * 4).fill(255) };

    const mipmaps = areaTextureMipmaps(128, 128, [{ image, x: 0, y: 0, width: 128, height: 128 }]);

    expect(mipmaps.map((mip) => mip[0])).toEqual(new Array(AREA_LIGHT_ATLAS_MIPMAPS).fill(255));
  });

  it('leaves every mip clear without a texture (edge case)', () => {
    const mipmaps = areaTextureMipmaps(128, 128, []);

    expect(mipmaps.every((mip) => mip.every((byte) => byte === 0))).toBe(true);
  });

  it('stops blurring a texture once its mip falls below one texel (error case)', () => {
    const image = { width: 2, height: 2, data: new Uint8Array(2 * 2 * 4).fill(255) };

    const mipmaps = areaTextureMipmaps(256, 256, [{ image, x: 0, y: 0, width: 2, height: 2 }]);

    expect([mipmaps[1]![0], mipmaps[2]![0]]).toEqual([255, 0]);
  });
});
