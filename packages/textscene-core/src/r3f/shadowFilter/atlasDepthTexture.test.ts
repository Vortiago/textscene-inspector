import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AtlasColourTexture } from './atlasColourTexture';
import { AtlasDepthTexture, atlasTargetOf, createShadowAtlas } from './atlasDepthTexture';

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

describe('atlasTargetOf', () => {
  it('finds the render target that holds the depth', () => {
    const target = new THREE.WebGLRenderTarget(64, 64);
    target.depthTexture = anAtlasDepth();
    expect(atlasTargetOf(target.depthTexture)).toBe(target);
  });

  it('is null for a depth texture no target holds (edge case)', () => {
    expect(atlasTargetOf(anAtlasDepth())).toBeNull();
  });

  it('is null for a value that is no depth texture (error case)', () => {
    expect(atlasTargetOf(undefined)).toBeNull();
    expect(atlasTargetOf(new Float32Array(1))).toBeNull();
  });
});

describe('createShadowAtlas', () => {
  const atlasDepth = {
    name: 'TestAtlas',
    size: 32,
    type: THREE.UnsignedShortType,
    compare: THREE.LessCompare,
  };

  it('builds a square target of the atlas depth and its colour copy', () => {
    const atlas = createShadowAtlas(atlasDepth);
    expect([atlas.width, atlas.height, atlas.texture.name, atlas.depthTexture!.name]).toEqual([
      32,
      32,
      'TestAtlasColour',
      'TestAtlas',
    ]);
  });

  it('gives the target the shared atlas textures', () => {
    const atlas = createShadowAtlas(atlasDepth);
    expect([
      atlas.texture instanceof AtlasColourTexture,
      atlas.depthTexture instanceof AtlasDepthTexture,
    ]).toEqual([true, true]);
  });

  it('is found again from its depth, as a reloaded module finds it (edge case)', () => {
    const atlas = createShadowAtlas(atlasDepth);
    expect(atlasTargetOf(atlas.depthTexture)).toBe(atlas);
  });
});
