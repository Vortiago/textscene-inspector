import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { rectTextureSampler } from './rectTexture';
import { CanvasItemTextureFilter, CanvasItemTextureRepeat } from '../../../../godot/scene/canvasItem';

const TEXTURE_SIZE = { x: 64, y: 32 };
const SAMPLER = { filter: CanvasItemTextureFilter.NEAREST, repeat: CanvasItemTextureRepeat.DISABLED };
const WHOLE = { offset: { x: 0, y: 0 }, size: TEXTURE_SIZE, tile: false, textureSize: TEXTURE_SIZE };
const NO_FLIP = { flipH: false, flipV: false };

describe('rectTextureSampler', () => {
  it('samples the undecoded bytes', () => {
    expect(rectTextureSampler(WHOLE, SAMPLER, NO_FLIP).colorSpace).toBe(THREE.NoColorSpace);
  });

  it("applies the item's sampler", () => {
    const { filter, wrap } = rectTextureSampler(WHOLE, SAMPLER, NO_FLIP);
    expect([filter?.magFilter, wrap]).toEqual([THREE.NearestFilter, THREE.ClampToEdgeWrapping]);
  });

  it("repeats a STRETCH_TILE draw whatever the item's texture_repeat", () => {
    const tiled = { ...WHOLE, size: { x: 128, y: 64 }, tile: true };
    const { wrap, window } = rectTextureSampler(tiled, SAMPLER, NO_FLIP);
    expect([wrap, window?.repeat]).toEqual([THREE.RepeatWrapping, { x: 2, y: 2 }]);
  });

  it('sets the flipped window of the draw', () => {
    expect(rectTextureSampler(WHOLE, SAMPLER, { flipH: false, flipV: true }).window).toEqual({
      repeat: { x: 1, y: -1 },
      offset: { x: 0, y: 1 },
    });
  });
});
