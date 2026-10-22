import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { dataArrayTexture } from './dataArrayTexture';

describe('dataArrayTexture', () => {
  it('holds the texels at their size, layer after layer', () => {
    const texels = new Uint16Array(2 * 1 * 3 * 4);
    const { image } = dataArrayTexture(texels, 2, 1, 3);
    expect([image.data, image.width, image.height, image.depth]).toEqual([texels, 2, 1, 3]);
  });

  it('reads half floats as linear HDR values, filtered linearly at mipmap 0', () => {
    const texture = dataArrayTexture(new Uint16Array(4), 1, 1, 1);
    expect([texture.type, texture.colorSpace, texture.minFilter, texture.magFilter]).toEqual([
      THREE.HalfFloatType,
      THREE.NoColorSpace,
      THREE.LinearFilter,
      THREE.LinearFilter,
    ]);
  });

  it('clamps a read past the edge of a layer (edge case)', () => {
    const texture = dataArrayTexture(new Uint16Array(4), 1, 1, 1);
    expect([texture.wrapS, texture.wrapT]).toEqual([THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping]);
  });
});
