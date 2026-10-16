import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { copySampling } from './copySampling';

describe('copySampling', () => {
  it("replaces a DataTexture's nearest, mip-free defaults with a loaded texture's sampling", () => {
    const loaded = new THREE.Texture();
    loaded.wrapS = THREE.RepeatWrapping;
    loaded.wrapT = THREE.MirroredRepeatWrapping;
    loaded.anisotropy = 4;

    const target = copySampling(new THREE.DataTexture(new Uint8Array(4), 1, 1), loaded);

    expect(target.magFilter).toBe(THREE.LinearFilter);
    expect(target.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(target.generateMipmaps).toBe(true);
    expect(target.wrapS).toBe(THREE.RepeatWrapping);
    expect(target.wrapT).toBe(THREE.MirroredRepeatWrapping);
    expect(target.anisotropy).toBe(4);
  });

  it('keeps a nearest, mip-free source as it is (edge case)', () => {
    const source = new THREE.DataTexture(new Uint8Array(4), 1, 1);

    const target = copySampling(new THREE.Texture(), source);

    expect(target.magFilter).toBe(THREE.NearestFilter);
    expect(target.generateMipmaps).toBe(false);
  });

  it('asks the GPU for a chain over a source that uploads its own chain', () => {
    const source = new THREE.DataTexture(new Uint8Array(8), 2, 1);
    source.mipmaps = [
      { data: new Uint8Array(8), width: 2, height: 1 },
      { data: new Uint8Array(4), width: 1, height: 1 },
    ] as unknown as THREE.Texture['mipmaps'];
    source.generateMipmaps = false;

    const target = copySampling(new THREE.DataTexture(new Uint8Array(4), 1, 1), source);

    expect(target.generateMipmaps).toBe(true);
  });

  it('returns the target it writes, not a copy', () => {
    const target = new THREE.DataTexture(new Uint8Array(4), 1, 1);

    expect(copySampling(target, new THREE.Texture())).toBe(target);
  });
});
