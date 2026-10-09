/**
 * The shared atlas texture, and the pending load a run holds until its image decodes. Each test
 * imports a fresh module, since the texture is created once per module.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import * as THREE from 'three';

/** A fresh atlas module whose image decodes only when the returned `decode` runs. */
async function freshAtlasModule() {
  vi.resetModules();
  const loads: Array<() => void> = [];
  vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
    const texture = new THREE.Texture<HTMLImageElement>();
    loads.push(() => onLoad?.(texture));
    return texture;
  });
  const module = await import('./atlasTexture');
  return { module, decode: () => loads.forEach((load) => load()) };
}

afterEach(() => vi.restoreAllMocks());

describe('getAtlasTexture', () => {
  it('loads the atlas once and shares the texture by identity', async () => {
    const { module } = await freshAtlasModule();

    expect(module.getAtlasTexture()).toBe(module.getAtlasTexture());
    expect(THREE.TextureLoader.prototype.load).toHaveBeenCalledTimes(1);
  });

  it('keeps the MSDF distances out of colour management (edge case)', async () => {
    const { module } = await freshAtlasModule();

    expect(module.getAtlasTexture().colorSpace).toBe(THREE.NoColorSpace);
  });
});

describe('useIsAtlasDecoded', () => {
  it('is false until the atlas image decodes, then true', async () => {
    const { module, decode } = await freshAtlasModule();
    module.getAtlasTexture();
    const { result } = renderHook(() => module.useIsAtlasDecoded());
    expect(result.current).toBe(false);

    act(decode);

    expect(result.current).toBe(true);
  });

  it('stays false while nothing has asked for the atlas (error path)', async () => {
    const { module, decode } = await freshAtlasModule();
    const { result } = renderHook(() => module.useIsAtlasDecoded());

    act(decode);

    expect(result.current).toBe(false);
  });
});
