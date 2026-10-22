/**
 * Godot's Nearest with Mipmaps and Anisotropic filters anisotropically under a nearest
 * magnification filter. three writes `TEXTURE_MAX_ANISOTROPY_EXT` only under a linear one
 * (`WebGLTextures.js:695`), so the draw site writes it onto the texture's GPU storage.
 */
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import { context } from '@react-three/fiber';
import { useNearestAnisotropy } from './nearestAnisotropy';

const GL = { TEXTURE_2D: 0x0de1, TEXTURE0: 0x84c0 };
const MAX_ANISOTROPY = 0x84fe;

function fakeCanvas({ isAllocated }: { isAllocated: boolean }) {
  const storage = { name: 'storage' };
  const gl = { ...GL, texParameterf: vi.fn() };
  const properties = isAllocated ? { __webglTexture: storage } : {};
  const renderer = {
    getContext: () => gl,
    state: { bindTexture: vi.fn() },
    properties: { get: () => properties },
    extensions: { get: () => ({ TEXTURE_MAX_ANISOTROPY_EXT: MAX_ANISOTROPY }) },
    capabilities: { getMaxAnisotropy: () => 8 },
    initTexture: vi.fn(() => {
      (properties as { __webglTexture?: unknown }).__webglTexture = storage;
    }),
  };
  const store = { getState: () => ({ gl: renderer }) };
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(context.Provider, { value: store as never }, children);
  return { gl, renderer, storage, wrapper };
}

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
