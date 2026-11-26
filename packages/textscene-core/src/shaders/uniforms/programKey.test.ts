import * as THREE from 'three';
import type { TextureNode } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { programKeyOf, textHash } from './programKey';

describe('textHash', () => {
  it('is one hash for one text', () => {
    expect(textHash('shader_type spatial;')).toBe(textHash('shader_type spatial;'));
  });

  it('differs for a text one character apart', () => {
    expect(textHash('ALBEDO = vec3(0.6);')).not.toBe(textHash('ALBEDO = vec3(0.5);'));
  });
});

describe('programKeyOf', () => {
  const keyWith = (texture: THREE.Texture) =>
    programKeyOf({ source: 'lit|code', textures: () => [{ value: texture } as TextureNode] });

  it('differs for a red and an RGBA texture, which three samples as a float and a vec4', () => {
    const red = new THREE.Data3DTexture();
    red.format = THREE.RedFormat;

    expect(keyWith(red)).not.toBe(keyWith(new THREE.Data3DTexture()));
  });

  it('differs for an array and a flat texture, which three declares as different samplers', () => {
    expect(keyWith(new THREE.DataArrayTexture())).not.toBe(keyWith(new THREE.DataTexture()));
  });

  it('differs for a cube and a flat texture, which three samples with different calls', () => {
    expect(keyWith(new THREE.CubeTexture())).not.toBe(keyWith(new THREE.Texture()));
  });
});
