import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AtlasColourTexture } from './atlasColourTexture';

describe('AtlasColourTexture', () => {
  it('holds two exact bytes per texel, read unfiltered', () => {
    const colour = new AtlasColourTexture('Atlas', 64);
    expect([colour.format, colour.type]).toEqual([THREE.RGFormat, THREE.UnsignedByteType]);
    expect([colour.minFilter, colour.magFilter]).toEqual([THREE.NearestFilter, THREE.NearestFilter]);
  });

  it('is its own clone, so every material samples the one texture (edge case)', () => {
    const colour = new AtlasColourTexture('Atlas', 64);
    expect(THREE.UniformsUtils.clone({ atlas: { value: colour } }).atlas!.value).toBe(colour);
  });

  it('takes the side it is given, even an empty one (error case)', () => {
    expect(new AtlasColourTexture('Atlas', 0).image).toMatchObject({ width: 0, height: 0 });
  });
});
