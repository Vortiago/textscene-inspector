/**
 * `useUndecodedTexture`: the NoColorSpace clone a 2D consumer draws. It never
 * retags the shared texture, disposes each clone it stops drawing, and, inside a
 * canvas, keeps drawing the previous clone while a large new one uploads.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { act, renderHook } from '@testing-library/react';
import { fakeTiledUploads } from './tiledUpload/fakeTiledUploads.testkit';
import { useUndecodedTexture } from './undecodedTexture';

function srgbTexture(name = 'small'): THREE.Texture {
  const texture = new THREE.Texture();
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.name = name;
  return texture;
}

describe('useUndecodedTexture', () => {
  it('draws a NoColorSpace clone and leaves the shared texture tagged sRGB', () => {
    const shared = srgbTexture();
    const { result } = renderHook(() => useUndecodedTexture(shared));

    expect(result.current).not.toBe(shared);
    expect(result.current?.colorSpace).toBe(THREE.NoColorSpace);
    expect(shared.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('draws nothing for no texture', () => {
    const { result } = renderHook(() => useUndecodedTexture(null));
    expect(result.current).toBeNull();
  });

  it('disposes the clone it replaces, and the last one on unmount', () => {
    const { result, rerender, unmount } = renderHook(({ texture }) => useUndecodedTexture(texture), {
      initialProps: { texture: srgbTexture() },
    });
    const first = result.current as THREE.Texture;
    const firstDispose = vi.spyOn(first, 'dispose');
    rerender({ texture: srgbTexture() });
    expect(firstDispose).toHaveBeenCalledTimes(1);

    const second = result.current as THREE.Texture;
    const secondDispose = vi.spyOn(second, 'dispose');
    unmount();
    expect(secondDispose).toHaveBeenCalledTimes(1);
  });

  it('keeps drawing the previous clone while a large new one uploads', async () => {
    const { pending, wrapper } = fakeTiledUploads();
    const { result, rerender } = renderHook(({ texture }) => useUndecodedTexture(texture), {
      initialProps: { texture: srgbTexture('large') },
      wrapper,
    });
    await act(async () => {
      pending[0]?.finish(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const first = result.current as THREE.Texture;
    const firstDispose = vi.spyOn(first, 'dispose');

    rerender({ texture: srgbTexture('large') });
    expect(result.current).toBe(first);
    expect(firstDispose).not.toHaveBeenCalled();

    await act(async () => {
      pending[1]?.finish(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current).not.toBe(first);
    expect(firstDispose).toHaveBeenCalledTimes(1);
  });
});
