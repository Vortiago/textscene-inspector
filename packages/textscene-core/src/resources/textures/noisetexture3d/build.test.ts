/**
 * NoiseTexture3D build: the sizes the previewer builds, and the 3D texture around the texels, set
 * up as Godot's fog shader samples a density texture (`environment/fog.cpp:259-260`).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MAX_3D_TEXTURE_EXTENT } from '../../../r3f/webglLimits';
import { noiseDataTexture3D, noiseTexture3DFits } from './build';
import { decodeNoiseTexture3D } from './decode';

describe('noiseTexture3DFits', () => {
  it('builds the default 64-cubed texture', () => {
    expect(noiseTexture3DFits(decodeNoiseTexture3D({}))).toBe(true);
  });

  it("refuses an axis past the previewer's 3D texture ceiling", () => {
    expect(noiseTexture3DFits(decodeNoiseTexture3D({ depth: String(MAX_3D_TEXTURE_EXTENT + 1) }))).toBe(
      false
    );
  });

  it('refuses a volume past Image::MAX_PIXELS, as Godot does (edge case)', () => {
    // `noise_texture_3d.cpp:150`: 2048 cubed is 2^33 texels, past 2^28.
    expect(noiseTexture3DFits(decodeNoiseTexture3D({ width: '2048', height: '2048', depth: '2048' }))).toBe(
      false
    );
  });
});

describe('noiseDataTexture3D', () => {
  const tex = decodeNoiseTexture3D({ width: '4', height: '3', depth: '2' });

  it('wraps the texels as a single-channel 3D texture of their size', () => {
    const texture = noiseDataTexture3D(new Uint8Array(24), tex);
    expect(texture).toBeInstanceOf(THREE.Data3DTexture);
    expect(texture.image).toMatchObject({ width: 4, height: 3, depth: 2 });
    expect(texture.format).toBe(THREE.RedFormat);
  });

  it('samples linearly, clamped, and as raw values', () => {
    const texture = noiseDataTexture3D(new Uint8Array(24), tex);
    expect([texture.magFilter, texture.minFilter]).toEqual([THREE.LinearFilter, THREE.LinearFilter]);
    expect(texture.wrapR).toBe(THREE.ClampToEdgeWrapping);
    expect(texture.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('takes its depth from the texels, which a seamless texture one slice deep doubles (edge case)', () => {
    const shallow = decodeNoiseTexture3D({ width: '4', height: '3', depth: '1', seamless: 'true' });
    expect(noiseDataTexture3D(new Uint8Array(24), shallow).image.depth).toBe(2);
  });
});
