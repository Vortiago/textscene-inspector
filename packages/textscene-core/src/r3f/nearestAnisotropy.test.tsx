/**
 * Godot's Nearest with Mipmaps and Anisotropic filters anisotropically under a nearest
 * magnification filter. three writes `TEXTURE_MAX_ANISOTROPY_EXT` only under a linear one
 * (`WebGLTextures.js:695`), so the draw site writes it onto the texture's GPU storage.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import { useNearestAnisotropy } from './nearestAnisotropy';
import {
  FAKE_GL as GL,
  MAX_ANISOTROPY_PARAMETER as MAX_ANISOTROPY,
  fakeCanvasRenderer as fakeCanvas,
} from './testing/fakeCanvasRenderer';

function nearestMipAnisotropic(anisotropy = 4): THREE.Texture {
  const texture = new THREE.Texture();
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.anisotropy = anisotropy;
  return texture;
}

describe('useNearestAnisotropy', () => {
  it('writes the anisotropy onto the storage three allocated, which it skips under a nearest magnification', () => {
    const { gl, renderer, storage, wrapper } = fakeCanvas({ isAllocated: true });
    renderHook(() => useNearestAnisotropy(nearestMipAnisotropic(4)), { wrapper });

    expect(renderer.state.bindTexture).toHaveBeenCalledWith(GL.TEXTURE_2D, storage, GL.TEXTURE0);
    expect(gl.texParameterf).toHaveBeenCalledWith(GL.TEXTURE_2D, MAX_ANISOTROPY, 4);
  });

  it('allocates a texture that has no storage yet, so there is something to write to', () => {
    const { gl, renderer, wrapper } = fakeCanvas({ isAllocated: false });
    const texture = nearestMipAnisotropic();
    renderHook(() => useNearestAnisotropy(texture), { wrapper });

    expect(renderer.initTexture).toHaveBeenCalledWith(texture);
    expect(gl.texParameterf).toHaveBeenCalledTimes(1);
  });

  it('writes no more than the GPU supports', () => {
    const { gl, wrapper } = fakeCanvas({ isAllocated: true });
    renderHook(() => useNearestAnisotropy(nearestMipAnisotropic(16)), { wrapper });

    expect(gl.texParameterf).toHaveBeenCalledWith(GL.TEXTURE_2D, MAX_ANISOTROPY, 8);
  });

  it.each([
    ['a linear magnification, which three handles', THREE.LinearFilter, THREE.LinearMipmapLinearFilter, 4],
    ['one tap', THREE.NearestFilter, THREE.NearestMipmapLinearFilter, 1],
    ['no mip chain to filter', THREE.NearestFilter, THREE.NearestFilter, 4],
  ])('leaves a texture with %s alone', (_name, magFilter, minFilter, anisotropy) => {
    const { gl, renderer, wrapper } = fakeCanvas({ isAllocated: true });
    const texture = nearestMipAnisotropic(anisotropy);
    texture.magFilter = magFilter;
    texture.minFilter = minFilter;
    renderHook(() => useNearestAnisotropy(texture), { wrapper });

    expect(gl.texParameterf).not.toHaveBeenCalled();
    expect(renderer.initTexture).not.toHaveBeenCalled();
  });

  it('does nothing outside a Canvas, where no renderer exists', () => {
    expect(() => renderHook(() => useNearestAnisotropy(nearestMipAnisotropic()))).not.toThrow();
  });
});
