import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AtlasDepthTexture } from './atlasDepthTexture';

/** A 16-bit atlas depth, as the positional atlas takes. */
function anAtlasDepth(): AtlasDepthTexture {
  return new AtlasDepthTexture({
    name: 'TestAtlas',
    size: 64,
    type: THREE.UnsignedShortType,
    compare: THREE.LessCompare,
  });
}

describe('AtlasDepthTexture', () => {
  it('is a square depth texture that a linear filter compares', () => {
    const depth = anAtlasDepth();
    expect(depth.name).toBe('TestAtlas');
    expect([depth.image.width, depth.image.height]).toEqual([64, 64]);
    expect(depth.type).toBe(THREE.UnsignedShortType);
    expect(depth.format).toBe(THREE.DepthFormat);
    expect(depth.compareFunction).toBe(THREE.LessCompare);
    expect([depth.minFilter, depth.magFilter]).toEqual([THREE.LinearFilter, THREE.LinearFilter]);
  });

  it('stays one texture through a material’s uniform clone', () => {
    const depth = anAtlasDepth();
    expect(THREE.UniformsUtils.clone({ atlas: { value: depth } }).atlas!.value).toBe(depth);
  });
});
