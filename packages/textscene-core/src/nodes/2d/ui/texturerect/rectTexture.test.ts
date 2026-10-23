import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { rectTexture } from './rectTexture';
import { CanvasItemTextureFilter, CanvasItemTextureRepeat } from '../../../../godot/scene/canvasItem';

const TEXTURE_SIZE = { x: 64, y: 32 };
const SAMPLER = { filter: CanvasItemTextureFilter.NEAREST, repeat: CanvasItemTextureRepeat.DISABLED };
const WHOLE = { offset: { x: 0, y: 0 }, size: TEXTURE_SIZE, tile: false, textureSize: TEXTURE_SIZE };
const NO_FLIP = { flipH: false, flipV: false };

function source(): THREE.Texture {
  const texture = new THREE.Texture();
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

describe('rectTexture', () => {
  it('draws a clone, so the shared texture keeps its own state', () => {
    const shared = source();
    const drawn = rectTexture(shared, WHOLE, SAMPLER, { flipH: true, flipV: false });
    expect(drawn).not.toBe(shared);
    expect([shared.colorSpace, shared.repeat.x]).toEqual([THREE.SRGBColorSpace, 1]);
  });

  it('samples the undecoded bytes, pinned against a later colour space write', () => {
    const drawn = rectTexture(source(), WHOLE, SAMPLER, NO_FLIP);
    drawn.colorSpace = THREE.SRGBColorSpace;
    expect(drawn.colorSpace).toBe(THREE.NoColorSpace);
  });

  it("applies the item's sampler", () => {
    const drawn = rectTexture(source(), WHOLE, SAMPLER, NO_FLIP);
    expect([drawn.magFilter, drawn.wrapS]).toEqual([THREE.NearestFilter, THREE.ClampToEdgeWrapping]);
  });

  it("repeats a STRETCH_TILE draw whatever the item's texture_repeat", () => {
    const tiled = { ...WHOLE, size: { x: 128, y: 64 }, tile: true };
    const drawn = rectTexture(source(), tiled, SAMPLER, NO_FLIP);
    expect([drawn.wrapS, drawn.wrapT]).toEqual([THREE.RepeatWrapping, THREE.RepeatWrapping]);
    expect(drawn.repeat.toArray()).toEqual([2, 2]);
  });

  it('sets the flipped window of the draw', () => {
    const drawn = rectTexture(source(), WHOLE, SAMPLER, { flipH: false, flipV: true });
    expect([drawn.repeat.toArray(), drawn.offset.toArray()]).toEqual([
      [1, -1],
      [0, 1],
    ]);
  });
});
