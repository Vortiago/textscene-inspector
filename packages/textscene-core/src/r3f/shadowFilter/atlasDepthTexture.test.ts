import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AtlasDepthTexture, atlasTargetOf } from './atlasDepthTexture';

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
