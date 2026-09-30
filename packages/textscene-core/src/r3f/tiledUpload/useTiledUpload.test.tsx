/**
 * The draw-site half of the tiled upload: a consumer gets its texture once every
 * row is on the GPU, keeps showing the previous one meanwhile, and hands each
 * texture it stops showing to `retire`, never one still on screen.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { act, renderHook } from '@testing-library/react';
import { pendingTextureWork } from '../../resources/textures/textureWork';
import { fakeTiledUploads, type FakeUpload } from './fakeTiledUploads.testkit';
import { useTiledUpload, useUploadedClone } from './useTiledUpload';

function named(name: string): THREE.Texture {
  const texture = new THREE.Texture();
  texture.name = name;
  return texture;
}

async function finish(entry: FakeUpload | undefined): Promise<void> {
  await act(async () => {
    entry?.finish(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useTiledUpload', () => {
  it('shows nothing until the first upload finishes, then the texture', async () => {
    const { pending, wrapper } = fakeTiledUploads();
    const texture = named('a');
    const retire = vi.fn();
    const { result } = renderHook(() => useTiledUpload(texture, retire), { wrapper });

    expect(result.current).toBeNull();
    await finish(pending[0]);
    expect(result.current).toBe(texture);
  });

  it('counts an upload as texture work until it finishes', async () => {
    const { pending, wrapper } = fakeTiledUploads();
    const texture = named('a');
    const retire = vi.fn();
    renderHook(() => useTiledUpload(texture, retire), { wrapper });
    expect(pendingTextureWork()).toBe(1);

    await finish(pending[0]);
    expect(pendingTextureWork()).toBe(0);
  });

  it('keeps showing the old texture while the new one uploads, then retires the old one', async () => {
    const { pending, wrapper } = fakeTiledUploads();
    const retire = vi.fn();
    const first = named('first');
    const second = named('second');
    const { result, rerender } = renderHook(({ texture }) => useTiledUpload(texture, retire), {
      initialProps: { texture: first },
      wrapper,
    });
    await finish(pending[0]);

    rerender({ texture: second });
    expect(result.current).toBe(first);
    expect(retire).not.toHaveBeenCalled();

    await finish(pending[1]);
    expect(result.current).toBe(second);
    expect(retire).toHaveBeenCalledWith(first);
  });

  it('cancels and retires an upload that a newer texture supersedes, never showing it', async () => {
    const { pending, wrapper } = fakeTiledUploads();
    const retire = vi.fn();
    const { result, rerender } = renderHook(({ texture }) => useTiledUpload(texture, retire), {
      initialProps: { texture: named('first') },
      wrapper,
    });
    const superseded = pending[0];

    rerender({ texture: named('second') });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(superseded?.cancelled).toBe(true);
    expect(retire).toHaveBeenCalledWith(superseded?.texture);
    expect(result.current).toBeNull();
  });

  it('passes a texture the queue does not tile straight through', () => {
    const { pending, wrapper } = fakeTiledUploads();
    const small = named('small');
    const { result } = renderHook(() => useTiledUpload(small, vi.fn()), { wrapper });

    expect(result.current).toBe(small);
    expect(pending).toHaveLength(0);
  });

  it('passes every texture straight through outside a canvas', () => {
    const texture = named('a');
    const { result } = renderHook(() => useTiledUpload(texture, vi.fn()));

    expect(result.current).toBe(texture);
  });

  it('passes a new texture through with no render of its own', () => {
    const retire = vi.fn();
    let renders = 0;
    const { rerender } = renderHook(
      ({ texture }) => {
        renders += 1;
        return useTiledUpload(texture, retire);
      },
      { initialProps: { texture: named('a') } }
    );
    rerender({ texture: named('b') });

    expect(renders).toBe(2);
  });

  it('settles when the caller builds a new texture every render', () => {
    const retire = vi.fn();
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useTiledUpload(named('fresh'), retire);
    });

    expect(renders).toBe(1);
  });

  it('retires a passed-through texture as soon as it is replaced', () => {
    const retire = vi.fn();
    const first = named('first');
    const { rerender } = renderHook(({ texture }) => useTiledUpload(texture, retire), {
      initialProps: { texture: first },
    });
    rerender({ texture: named('second') });

    expect(retire).toHaveBeenCalledWith(first);
  });

  it('retires everything it holds on unmount, and cancels an upload in flight', async () => {
    const { pending, wrapper } = fakeTiledUploads();
    const retire = vi.fn();
    const first = named('first');
    const second = named('second');
    const { rerender, unmount } = renderHook(({ texture }) => useTiledUpload(texture, retire), {
      initialProps: { texture: first },
      wrapper,
    });
    await finish(pending[0]);
    rerender({ texture: second });
    unmount();

    expect(pending[1]?.cancelled).toBe(true);
    expect(retire).toHaveBeenCalledWith(first);
    expect(retire).toHaveBeenCalledWith(second);
    expect(pendingTextureWork()).toBe(0);
  });

  it('shows nothing, and retires what it held, when the texture goes away', async () => {
    const { pending, wrapper } = fakeTiledUploads();
    const retire = vi.fn();
    const first = named('first');
    const { result, rerender } = renderHook(
      ({ texture }: { texture: THREE.Texture | null }) => useTiledUpload(texture, retire),
      { initialProps: { texture: first as THREE.Texture | null }, wrapper }
    );
    await finish(pending[0]);
    rerender({ texture: null });

    expect(result.current).toBeNull();
    expect(retire).toHaveBeenCalledWith(first);
  });
});

describe('useUploadedClone', () => {
  it('draws a consumer\'s own clone and disposes it once replaced', () => {
    const first = named('first');
    const dispose = vi.spyOn(first, 'dispose');
    const { result, rerender } = renderHook(({ texture }) => useUploadedClone(texture), {
      initialProps: { texture: first },
    });
    expect(result.current).toBe(first);

    rerender({ texture: named('second') });
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps drawing the previous clone while a large new one uploads', async () => {
    const { pending, wrapper } = fakeTiledUploads();
    const first = named('first');
    const { result, rerender } = renderHook(({ texture }) => useUploadedClone(texture), {
      initialProps: { texture: first },
      wrapper,
    });
    await finish(pending[0]);
    const dispose = vi.spyOn(first, 'dispose');

    rerender({ texture: named('second') });
    expect(result.current).toBe(first);
    expect(dispose).not.toHaveBeenCalled();
  });
});
