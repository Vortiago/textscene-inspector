import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import { drawAtAnisotropicLevel, useViewportAnisotropy, writeViewportAnisotropy } from './viewportAnisotropy';
import { FAKE_GL, MAX_ANISOTROPY_PARAMETER, fakeCanvasRenderer } from './testing/fakeCanvasRenderer';

interface TextureFilters {
  anisotropy: number;
  magFilter: THREE.MagnificationTextureFilter;
  minFilter: THREE.MinificationTextureFilter;
}

/** Godot's filter 5 by default: a linear sampler with a mip chain on an anisotropic row. */
function textureWith(filters: Partial<TextureFilters> = {}): THREE.Texture {
  const texture = new THREE.Texture();
  texture.anisotropy = 4;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return Object.assign(texture, filters);
}

/** The taps each GPU write set, in order. */
const writtenTaps = (texParameterf: ReturnType<typeof vi.fn>) =>
  texParameterf.mock.calls.map(([, , taps]) => taps as number);

describe('drawAtAnisotropicLevel', () => {
  it("draws a held texture at the level of each viewport's draw, one after the other", () => {
    const { gl, wrapper } = fakeCanvasRenderer({ isAllocated: true, maxAnisotropy: 16 });
    renderHook(() => useViewportAnisotropy(textureWith()), { wrapper });
    gl.texParameterf.mockClear();
    const seen: number[] = [];

    drawAtAnisotropicLevel(0, () => seen.push(...writtenTaps(gl.texParameterf)));
    gl.texParameterf.mockClear();
    drawAtAnisotropicLevel(4, () => seen.push(...writtenTaps(gl.texParameterf)));

    expect(seen).toEqual([1, 16]);
  });

  it("writes the outer draw's level back when a nested draw returns", () => {
    const { gl, wrapper } = fakeCanvasRenderer({ isAllocated: true, maxAnisotropy: 16 });
    renderHook(() => useViewportAnisotropy(textureWith()), { wrapper });
    let afterNested: number | undefined;

    drawAtAnisotropicLevel(1, () => {
      drawAtAnisotropicLevel(3, () => undefined);
      afterNested = writtenTaps(gl.texParameterf).at(-1);
    });

    expect(afterNested).toBe(2);
  });

  it("gives a canvas draw the texture's own taps, Godot's default samplers", () => {
    const { gl, wrapper } = fakeCanvasRenderer({ isAllocated: true, maxAnisotropy: 16 });
    renderHook(() => useViewportAnisotropy(textureWith()), { wrapper });

    drawAtAnisotropicLevel(4, () => drawAtAnisotropicLevel(null, () => undefined));

    // The mount, the outer draw, the canvas inside it, the outer again, then outside every draw.
    expect(writtenTaps(gl.texParameterf)).toEqual([4, 16, 4, 16, 4]);
  });

  it('writes nothing again for a second draw at the same level', () => {
    const { gl, wrapper } = fakeCanvasRenderer({ isAllocated: true });
    renderHook(() => useViewportAnisotropy(textureWith()), { wrapper });
    drawAtAnisotropicLevel(2, () => undefined);
    gl.texParameterf.mockClear();

    drawAtAnisotropicLevel(2, () => undefined);

    expect(gl.texParameterf).not.toHaveBeenCalled();
  });

  it('writes no texture whose hook has unmounted', () => {
    const { gl, wrapper } = fakeCanvasRenderer({ isAllocated: true, maxAnisotropy: 16 });
    const { unmount } = renderHook(() => useViewportAnisotropy(textureWith()), { wrapper });
    unmount();
    gl.texParameterf.mockClear();

    drawAtAnisotropicLevel(4, () => undefined);

    expect(gl.texParameterf).not.toHaveBeenCalled();
  });

  it('writes the level of the draw under way after an upload inside it', () => {
    const { gl, wrapper } = fakeCanvasRenderer({ isAllocated: false, maxAnisotropy: 16 });
    const texture = textureWith();
    renderHook(() => useViewportAnisotropy(texture), { wrapper });

    drawAtAnisotropicLevel(3, () => texture.onUpdate!(texture));

    expect(gl.texParameterf).toHaveBeenCalledWith(FAKE_GL.TEXTURE_2D, MAX_ANISOTROPY_PARAMETER, 8);
  });
});

describe('writeViewportAnisotropy', () => {
  it('writes the level of the draw under way onto a texture no hook holds, as the decal atlas', () => {
    const { gl, renderer } = fakeCanvasRenderer({ isAllocated: true, maxAnisotropy: 16 });

    drawAtAnisotropicLevel(1, () => writeViewportAnisotropy(renderer as never, textureWith()));

    expect(gl.texParameterf).toHaveBeenCalledWith(FAKE_GL.TEXTURE_2D, MAX_ANISOTROPY_PARAMETER, 2);
  });
});

describe('useViewportAnisotropy', () => {
  it('writes the taps onto a texture that is already on the GPU, as a tiled one is', () => {
    const { gl, renderer, storage, wrapper } = fakeCanvasRenderer({ isAllocated: true });
    renderHook(() => useViewportAnisotropy(textureWith({ magFilter: THREE.NearestFilter })), { wrapper });

    expect(renderer.state.bindTexture).toHaveBeenCalledWith(FAKE_GL.TEXTURE_2D, storage, FAKE_GL.TEXTURE0);
    expect(gl.texParameterf).toHaveBeenCalledWith(FAKE_GL.TEXTURE_2D, MAX_ANISOTROPY_PARAMETER, 4);
  });

  it('writes them after each upload of a texture that is not on the GPU yet, and starts no upload itself', () => {
    const { gl, wrapper } = fakeCanvasRenderer({ isAllocated: false });
    const texture = textureWith();
    renderHook(() => useViewportAnisotropy(texture), { wrapper });
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
    const { unmount } = renderHook(() => useViewportAnisotropy(texture), { wrapper });

    texture.onUpdate!(texture);
    expect(original).toHaveBeenCalledWith(texture);
    unmount();
    expect(texture.onUpdate).toBe(original);
  });

  it("keeps a later hook's wrapper when an earlier hook on the same texture unmounts first", () => {
    const { gl, wrapper } = fakeCanvasRenderer({ isAllocated: false });
    const texture = textureWith();
    const first = renderHook(() => useViewportAnisotropy(texture), { wrapper });
    renderHook(() => useViewportAnisotropy(texture), { wrapper });

    first.unmount();
    texture.onUpdate!(texture);

    expect(gl.texParameterf).toHaveBeenCalled();
  });

  it('writes once per upload and restores the callback when hooks on a shared texture unmount in any order', () => {
    const { gl, wrapper } = fakeCanvasRenderer({ isAllocated: false });
    const texture = textureWith();
    const original = vi.fn();
    texture.onUpdate = original;
    const first = renderHook(() => useViewportAnisotropy(texture), { wrapper });
    const second = renderHook(() => useViewportAnisotropy(texture), { wrapper });

    texture.onUpdate!(texture);
    expect(gl.texParameterf).toHaveBeenCalledTimes(1);
    first.unmount();
    second.unmount();

    expect(texture.onUpdate).toBe(original);
  });

  it('writes the taps a texture gains after it mounted with one tap', () => {
    const { gl, wrapper } = fakeCanvasRenderer({ isAllocated: false });
    const texture = textureWith({ anisotropy: 1 });
    renderHook(() => useViewportAnisotropy(texture), { wrapper });

    texture.anisotropy = 2;
    texture.onUpdate!(texture);

    expect(gl.texParameterf).toHaveBeenCalledWith(FAKE_GL.TEXTURE_2D, MAX_ANISOTROPY_PARAMETER, 2);
  });

  it('writes nothing, even after an upload, on a GPU without the anisotropic extension', () => {
    const { gl, wrapper } = fakeCanvasRenderer({ isAllocated: true, hasAnisotropyExtension: false });
    const texture = textureWith();
    renderHook(() => useViewportAnisotropy(texture), { wrapper });
    texture.onUpdate!(texture);

    expect(gl.texParameterf).not.toHaveBeenCalled();
  });

  it('writes no more than the GPU supports', () => {
    const { gl, wrapper } = fakeCanvasRenderer({ isAllocated: true });
    renderHook(() => useViewportAnisotropy(textureWith({ anisotropy: 16 })), { wrapper });

    expect(gl.texParameterf).toHaveBeenCalledWith(FAKE_GL.TEXTURE_2D, MAX_ANISOTROPY_PARAMETER, 8);
  });

  it('writes nothing, even after an upload, for a texture on a row with one tap', () => {
    const { gl, wrapper } = fakeCanvasRenderer({ isAllocated: true });
    const texture = textureWith({ anisotropy: 1 });
    renderHook(() => useViewportAnisotropy(texture), { wrapper });
    texture.onUpdate!(texture);

    expect(gl.texParameterf).not.toHaveBeenCalled();
  });

  it('does nothing outside a Canvas, where no renderer exists', () => {
    expect(() => renderHook(() => useViewportAnisotropy(textureWith()))).not.toThrow();
  });
});
