import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as imagePixels from '../../resources/formats/image/imagePixels';
import { imageSize } from '../../resources/formats/image/imagePixels';
import { texture2DPlaceholder } from '../../resources/textures/texture2DPlaceholder';
import type { AtlasSourceModel } from '../../resources/tileset/types';
import { useRuntimeAtlasTexture } from './paddedAtlasTexture';

const SOURCE: AtlasSourceModel = {
  texture: null,
  margins: { x: 0, y: 0 },
  separation: { x: 0, y: 0 },
  textureRegionSize: { x: 2, y: 2 },
  usesTexturePadding: true,
  tiles: new Map([['0:0', { sizeInAtlas: { x: 1, y: 1 }, alternatives: new Map() }]]),
};

function textureOf(): THREE.DataTexture {
  return new THREE.DataTexture(new Uint8Array(2 * 2 * 4).fill(255), 2, 2);
}

const slotOf = (texture: THREE.Texture) => ({ texture });

/** The release disposes in a microtask, so a test waits one out. */
const flushMicrotasks = () => Promise.resolve();

async function builtCopy(texture: THREE.Texture, source = SOURCE) {
  const hook = renderHook(() => useRuntimeAtlasTexture(slotOf(texture), source));
  await vi.waitFor(() => expect(hook.result.current).not.toBeNull());
  return hook;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useRuntimeAtlasTexture', () => {
  it('reads no pixels in the render that asks for the padded copy', () => {
    const read = vi.spyOn(imagePixels, 'readImagePixels');

    const { result } = renderHook(() => useRuntimeAtlasTexture(slotOf(textureOf()), SOURCE));

    expect([result.current, read.mock.calls.length]).toEqual([null, 0]);
  });

  it('gives the padded copy once it is built, one texel of border around each tile', async () => {
    const { result } = await builtCopy(textureOf());

    expect(imageSize(result.current!.image)).toEqual({ width: 4, height: 4 });
  });

  it('gives the texture itself for a source with no padding', () => {
    const texture = textureOf();

    const { result } = renderHook(() =>
      useRuntimeAtlasTexture(slotOf(texture), { ...SOURCE, usesTexturePadding: false })
    );

    expect(result.current).toBe(texture);
  });

  it('gives the placeholder for a texture with no image, as Godot pads an empty one', () => {
    const { result } = renderHook(() =>
      useRuntimeAtlasTexture({ texture: textureOf(), hasNoImage: true }, SOURCE)
    );

    expect(result.current).toBe(texture2DPlaceholder());
  });

  it('gives the placeholder for a texture whose pixels cannot be read', async () => {
    vi.spyOn(imagePixels, 'readImagePixels').mockReturnValue(undefined);

    const { result } = await builtCopy(textureOf());

    expect(result.current).toBe(texture2DPlaceholder());
  });

  it('shares one padded copy between the runs of a source', async () => {
    const texture = textureOf();

    const first = await builtCopy(texture);
    const second = await builtCopy(texture);

    expect(second.result.current).toBe(first.result.current);
  });

  it('disposes the shared copy when its last run releases it', async () => {
    const texture = textureOf();
    const first = await builtCopy(texture);
    const second = await builtCopy(texture);
    const onDispose = vi.fn();
    first.result.current!.addEventListener('dispose', onDispose);

    first.unmount();
    await flushMicrotasks();
    const disposedWhileHeld = onDispose.mock.calls.length;
    second.unmount();
    await flushMicrotasks();

    expect(disposedWhileHeld).toBe(0);
    expect(onDispose).toHaveBeenCalledTimes(1);
  });
});
