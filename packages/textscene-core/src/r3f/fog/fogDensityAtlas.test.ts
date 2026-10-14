/**
 * The density textures of the drawn FogVolumes, stacked in depth into the one 3D texture the light
 * pass samples.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MAX_3D_TEXTURE_EXTENT } from '../webglLimits';
import { FogDensityAtlas } from './fogDensityAtlas';

function volume(width: number, height: number, depth: number, fill = 0): THREE.Data3DTexture {
  return new THREE.Data3DTexture(new Uint8Array(width * height * depth).fill(fill), width, height, depth);
}

describe('FogDensityAtlas.update', () => {
  it('stacks each texture after the last, as wide and tall as the largest', () => {
    const atlas = new FogDensityAtlas();
    const first = volume(4, 3, 2);
    const second = volume(2, 5, 3);
    atlas.update([first, second]);
    expect(atlas.texture.image).toMatchObject({ width: 4, height: 5, depth: 5 });
    expect(atlas.regionOf(first)).toEqual({ width: 4, height: 3, depth: 2, zStart: 0 });
    expect(atlas.regionOf(second)).toEqual({ width: 2, height: 5, depth: 3, zStart: 2 });
  });

  it('copies each row of a texture into its region', () => {
    const atlas = new FogDensityAtlas();
    const narrow = new THREE.Data3DTexture(new Uint8Array([1, 2, 3, 4]), 2, 2, 1);
    atlas.update([volume(3, 2, 1), narrow]);
    const data = atlas.texture.image.data as Uint8Array;
    // The second slice starts at 3 x 2 texels, and its rows are 3 texels apart.
    expect(Array.from(data.subarray(6, 12))).toEqual([1, 2, 0, 3, 4, 0]);
  });

  it('stacks a texture two volumes share once', () => {
    const atlas = new FogDensityAtlas();
    const shared = volume(4, 4, 4);
    atlas.update([shared, shared]);
    expect(atlas.texture.image.depth).toBe(4);
  });

  it('answers whether the stack changed', () => {
    const atlas = new FogDensityAtlas();
    const textures = [volume(2, 2, 2)];
    expect(atlas.update(textures)).toBe(true);
    expect(atlas.update(textures)).toBe(false);
    expect(atlas.update([])).toBe(true);
  });

  it('counts each new stack in its version', () => {
    const atlas = new FogDensityAtlas();
    const textures = [volume(2, 2, 2)];
    atlas.update(textures);
    atlas.update(textures);
    expect(atlas.version).toBe(1);
  });

  it('leaves out a texture past the 3D texture ceiling, which samples as no texture (edge case)', () => {
    const atlas = new FogDensityAtlas();
    const deep = volume(1, 1, MAX_3D_TEXTURE_EXTENT);
    const over = volume(1, 1, 1);
    atlas.update([deep, over]);
    expect(atlas.regionOf(over)).toBeUndefined();
    expect(atlas.texture.image.depth).toBe(MAX_3D_TEXTURE_EXTENT);
  });

  it('holds a one-texel texture while no volume has a density texture', () => {
    const atlas = new FogDensityAtlas();
    atlas.update([]);
    expect(atlas.texture.image).toMatchObject({ width: 1, height: 1, depth: 1 });
  });
});
