import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import { useNearestAnisotropy } from './nearestAnisotropy';
import { FAKE_GL, MAX_ANISOTROPY_PARAMETER, fakeCanvasRenderer } from './testing/fakeCanvasRenderer';

interface TextureFilters {
  anisotropy: number;
  magFilter: THREE.MagnificationTextureFilter;
  minFilter: THREE.MinificationTextureFilter;
}

/** Godot's filter 4 by default: a nearest sampler with a mip chain and 4 taps. */
function textureWith(filters: Partial<TextureFilters> = {}): THREE.Texture {
  const texture = new THREE.Texture();
  texture.anisotropy = 4;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  return Object.assign(texture, filters);
}

describe('useNearestAnisotropy', () => {
  it('writes the anisotropy onto a texture that is already on the GPU, as a tiled one is', () => {
    const { gl, renderer, storage, wrapper } = fakeCanvasRenderer({ isAllocated: true });
    renderHook(() => useNearestAnisotropy(textureWith()), { wrapper });

    expect(renderer.state.bindTexture).toHaveBeenCalledWith(FAKE_GL.TEXTURE_2D, storage, FAKE_GL.TEXTURE0);
    expect(gl.texParameterf).toHaveBeenCalledWith(FAKE_GL.TEXTURE_2D, MAX_ANISOTROPY_PARAMETER, 4);
  });

  it('writes it after each upload of a texture that is not on the GPU yet, and starts no upload itself', () => {
    const { gl, wrapper } = fakeCanvasRenderer({ isAllocated: false });
    const texture = textureWith();
    renderHook(() => useNearestAnisotropy(texture), { wrapper });
    expect(gl.texParameterf).not.toHaveBeenCalled();

    texture.onUpdate!(texture);
    texture.onUpdate!(texture);

    expect(gl.texParameterf).toHaveBeenCalledTimes(2);
    expect(gl.texParameterf).toHaveBeenCalledWith(FAKE_GL.TEXTURE_2D, MAX_ANISOTROPY_PARAMETER, 4);
  });

  it('keeps the upload callback the texture had, and restores it on unmount', () => {
    const { wrapper } = fakeCanvasRenderer({ isAllocated: false });
    const texture = textureWith();
    const original = vi.fn();
    texture.onUpdate = original;
    const { unmount } = renderHook(() => useNearestAnisotropy(texture), { wrapper });

    texture.onUpdate!(texture);
    expect(original).toHaveBeenCalledWith(texture);
    unmount();
    expect(texture.onUpdate).toBe(original);
  });

  it("keeps a later hook's wrapper when an earlier hook on the same texture unmounts first", () => {
    const { gl, wrapper } = fakeCanvasRenderer({ isAllocated: false });
    const texture = textureWith();
    const first = renderHook(() => useNearestAnisotropy(texture), { wrapper });
    renderHook(() => useNearestAnisotropy(texture), { wrapper });

    first.unmount();
    texture.onUpdate!(texture);

    expect(gl.texParameterf).toHaveBeenCalled();
  });

  it('writes nothing on a GPU without the anisotropic extension', () => {
    const { gl, wrapper } = fakeCanvasRenderer({ isAllocated: true, hasAnisotropyExtension: false });
    const texture = textureWith();
    const original = texture.onUpdate;
    renderHook(() => useNearestAnisotropy(texture), { wrapper });

    expect(gl.texParameterf).not.toHaveBeenCalled();
    expect(texture.onUpdate).toBe(original);
  });

  it('writes no more than the GPU supports', () => {
    const { gl, wrapper } = fakeCanvasRenderer({ isAllocated: true });
    renderHook(() => useNearestAnisotropy(textureWith({ anisotropy: 16 })), { wrapper });

    expect(gl.texParameterf).toHaveBeenCalledWith(FAKE_GL.TEXTURE_2D, MAX_ANISOTROPY_PARAMETER, 8);
  });

  it.each<[string, Partial<TextureFilters>]>([
    ['a linear magnification, which three handles', { magFilter: THREE.LinearFilter }],
    ['one tap', { anisotropy: 1 }],
    ['no mip chain to filter', { minFilter: THREE.NearestFilter }],
  ])('leaves a texture with %s alone', (_name, filters) => {
    const { gl, wrapper } = fakeCanvasRenderer({ isAllocated: true });
    const texture = textureWith(filters);
    const original = texture.onUpdate;
    renderHook(() => useNearestAnisotropy(texture), { wrapper });

    expect(gl.texParameterf).not.toHaveBeenCalled();
    expect(texture.onUpdate).toBe(original);
  });

  it('does nothing outside a Canvas, where no renderer exists', () => {
    expect(() => renderHook(() => useNearestAnisotropy(textureWith()))).not.toThrow();
  });
});
