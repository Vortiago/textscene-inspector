/**
 * A consumer's texture view as it draws: made once for the state it states, uploaded in bands where
 * large, and freed once nothing draws it. A source a view shares is never freed.
 */
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { act, renderHook } from '@testing-library/react';
import { godotTextureFilterState } from '../resources/textures/godotTextureFilter';
import type { ViewSampler } from '../resources/textures/textureView';
import { fakeTiledUploads } from './tiledUpload/fakeTiledUploads.testkit';
import { useOwnedTextureView, useTextureView } from './useTextureView';

const RAW_REPEAT: ViewSampler = { colorSpace: THREE.NoColorSpace, wrap: THREE.RepeatWrapping };

function source(name = 'source'): THREE.Texture {
  const texture = new THREE.Texture();
  texture.name = name;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Lets the microtask that frees a released texture run. */
const settle = () => act(async () => Promise.resolve());

describe('useTextureView', () => {
  it('draws the source itself when it already samples as stated', () => {
    const shared = source();
    const { result } = renderHook(() => useTextureView(shared, RAW_REPEAT));
    expect(result.current).toBe(shared);
  });

  it('draws one clone that carries the stated state, and leaves the source as it was', () => {
    const shared = source();
    const { result } = renderHook(() =>
      useTextureView(shared, { ...RAW_REPEAT, filter: godotTextureFilterState(0) })
    );

    expect(result.current).not.toBe(shared);
    expect(result.current?.magFilter).toBe(THREE.NearestFilter);
    expect(shared.magFilter).toBe(THREE.LinearFilter);
  });

  it('draws the source when no sampler is stated', () => {
    const shared = source();
    const { result } = renderHook(() => useTextureView(shared, null));
    expect(result.current).toBe(shared);
  });

  it('draws nothing without a source', () => {
    expect(renderHook(() => useTextureView(null, RAW_REPEAT)).result.current).toBeNull();
    expect(renderHook(() => useTextureView(undefined, RAW_REPEAT)).result.current).toBeNull();
  });

  it('keeps the view when a new sampler object states the same values', () => {
    const shared = source();
    const { result, rerender } = renderHook(
      ({ colorSpace }) => useTextureView(shared, { colorSpace, wrap: THREE.ClampToEdgeWrapping }),
      { initialProps: { colorSpace: THREE.SRGBColorSpace as THREE.ColorSpace } }
    );
    const first = result.current;

    rerender({ colorSpace: THREE.SRGBColorSpace });

    expect(result.current).toBe(first);
  });

  it('frees the clone once the consumer unmounts', async () => {
    const { result, unmount } = renderHook(() =>
      useTextureView(source(), { ...RAW_REPEAT, filter: godotTextureFilterState(0) })
    );
    const dispose = vi.spyOn(result.current!, 'dispose');

    unmount();
    await settle();

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('frees the clone a new sampler replaces', async () => {
    const shared = source();
    const { result, rerender } = renderHook(
      ({ filter }) => useTextureView(shared, { ...RAW_REPEAT, filter: godotTextureFilterState(filter) }),
      { initialProps: { filter: 0 } }
    );
    const dispose = vi.spyOn(result.current!, 'dispose');

    rerender({ filter: 1 });
    await settle();

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('never frees a shared source', async () => {
    const shared = source();
    const dispose = vi.spyOn(shared, 'dispose');
    const { unmount } = renderHook(() => useTextureView(shared, RAW_REPEAT));

    unmount();
    await settle();

    expect(dispose).not.toHaveBeenCalled();
  });

  it('keeps a clone that StrictMode releases and takes again', async () => {
    const shared = source();
    const { result } = renderHook(
      () => useTextureView(shared, { ...RAW_REPEAT, filter: godotTextureFilterState(0) }),
      { wrapper: StrictMode }
    );
    const dispose = vi.spyOn(result.current!, 'dispose');

    await settle();

    expect(dispose).not.toHaveBeenCalled();
  });

  it('keeps drawing the previous clone while a large new one uploads, then frees it', async () => {
    const { pending, wrapper } = fakeTiledUploads();
    const shared = source();
    const { result, rerender } = renderHook(
      ({ filter }) => useTextureView(shared, { ...RAW_REPEAT, filter: godotTextureFilterState(filter) }),
      { initialProps: { filter: 0 }, wrapper }
    );
    await act(async () => {
      pending[0]?.finish(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const first = result.current!;
    const dispose = vi.spyOn(first, 'dispose');

    rerender({ filter: 1 });
    await settle();
    expect(result.current).toBe(first);
    expect(dispose).not.toHaveBeenCalled();

    await act(async () => {
      pending[1]?.finish(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current).not.toBe(first);
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});

describe('useOwnedTextureView', () => {
  it('draws a clone even when the source already samples as stated', () => {
    const shared = source();
    const { result } = renderHook(() => useOwnedTextureView(shared, RAW_REPEAT));

    expect(result.current).not.toBe(shared);
    expect(result.current?.source).toBe(shared.source);
  });

  it('keeps the clone, and a window written on it, across a render that states the same values', () => {
    const shared = source();
    const { result, rerender } = renderHook(() => useOwnedTextureView(shared, RAW_REPEAT));
    result.current!.offset.set(0.5, 0);

    rerender();

    expect(result.current?.offset.x).toBe(0.5);
  });

  it('frees the clone once the consumer unmounts, and not the source', async () => {
    const shared = source();
    const sourceDispose = vi.spyOn(shared, 'dispose');
    const { result, unmount } = renderHook(() => useOwnedTextureView(shared, RAW_REPEAT));
    const dispose = vi.spyOn(result.current!, 'dispose');

    unmount();
    await settle();

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(sourceDispose).not.toHaveBeenCalled();
  });

  it('draws nothing without a source', () => {
    expect(renderHook(() => useOwnedTextureView(null, RAW_REPEAT)).result.current).toBeNull();
  });
});
