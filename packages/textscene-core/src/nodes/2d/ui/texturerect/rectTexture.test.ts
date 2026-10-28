import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { rectTextureSampler, sampledDraw } from './rectTexture';
import { textureRectDraw } from './nativeSolver';
import { TextureStretchMode } from '../../../../godot/scene/textureStretch';
import { unconfiguredViewportTexture } from '../../../../resources/textures/viewporttexture/unconfiguredViewportTexture';
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

describe('sampledDraw', () => {
  const RECT = { x: 20, y: 10 };
  const keep = (reported: { x: number; y: number }) =>
    textureRectDraw(RECT, reported, TextureStretchMode.STRETCH_KEEP);

  it('lays the draw out by the image size and samples the same size', () => {
    const texture = new THREE.DataTexture(new Uint8Array(6 * 2 * 4), 6, 2);
    expect(sampledDraw(texture, keep)).toMatchObject({ size: { x: 6, y: 2 }, textureSize: { x: 6, y: 2 } });
  });

  /** Godot lays out by the reported size 0 (`viewport.cpp:156-160`) and samples the 4x4 placeholder. */
  it('lays an unset ViewportTexture out at size 0 and samples the placeholder image', () => {
    expect(sampledDraw(unconfiguredViewportTexture(), keep)).toMatchObject({
      size: { x: 0, y: 0 },
      textureSize: { x: 4, y: 4 },
    });
  });

  it('draws nothing for a texture with no image yet', () => {
    expect(sampledDraw(new THREE.Texture(), keep)).toBeNull();
  });

  it('draws nothing for no texture', () => {
    expect(sampledDraw(null, keep)).toBeNull();
  });
});
