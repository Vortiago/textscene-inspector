import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as imagePixels from '../../resources/formats/image/imagePixels';
import { imageSize } from '../../resources/formats/image/imagePixels';
import { texture2DPlaceholder } from '../../resources/textures/texture2DPlaceholder';
import type { AtlasSourceModel } from '../../resources/tileset/types';
import { textureWork } from '../../resources/textures/textureWork';
import { inThreadJobRunner } from '../../workers/WorkerJobRunner';
import { topDownTexture } from '../../resources/textures/topDownTexture';
import { useRuntimeAtlasTexture, type RuntimeAtlas } from './paddedAtlasTexture';

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
  await vi.waitFor(() => expect(hook.result.current).not.toBe('building'));
  return hook;
}

/** The texture a built hook gives, which a test that expects one reads. */
function textureIn(result: { current: RuntimeAtlas }): THREE.Texture {
  if (!(result.current instanceof THREE.Texture))
    throw new Error(`expected a texture, got ${result.current}`);
  return result.current;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useRuntimeAtlasTexture', () => {
  it('reads no pixels in the render that asks for the padded copy', () => {
    const read = vi.spyOn(imagePixels, 'readImagePixels');

    const { result } = renderHook(() => useRuntimeAtlasTexture(slotOf(textureOf()), SOURCE));

    expect([result.current, read.mock.calls.length]).toEqual(['building', 0]);
  });

  it('gives the padded copy once it is built, one texel of border around each tile', async () => {
    const { result } = await builtCopy(textureOf());

    expect(imageSize(textureIn(result).image)).toEqual({ width: 4, height: 4 });
  });

  it('pads a half-float texture in half floats, keeping a value above 1', async () => {
    const two = 0x4000;
    const texels = new Uint16Array(2 * 2 * 4).fill(two);
    const halfFloats = new THREE.DataTexture(texels, 2, 2, THREE.RGBAFormat, THREE.HalfFloatType);
    const { result } = await builtCopy(halfFloats);

    const padded = textureIn(result) as THREE.DataTexture;
    expect([padded.type, (padded.image.data as Uint16Array)[0]]).toEqual([THREE.HalfFloatType, two]);
  });

  it('gives the padded copy top row first, so the shader samples it without a turned copy', async () => {
    const { result } = await builtCopy(textureOf());

    expect(topDownTexture(textureIn(result))).toBe(result.current);
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

  it('gives no atlas for a texture whose pixels cannot be read', async () => {
    vi.spyOn(imagePixels, 'readImagePixels').mockReturnValue(undefined);

    const { result } = await builtCopy(textureOf());

    expect(result.current).toBe('unreadable');
  });

  it('pads a texture whose pixels become readable at its next version', async () => {
    const texture = textureOf();
    vi.spyOn(imagePixels, 'readImagePixels').mockReturnValueOnce(undefined);
    const hook = await builtCopy(texture);

    texture.needsUpdate = true;
    hook.rerender();

    await vi.waitFor(() => expect(hook.result.current).toBeInstanceOf(THREE.DataTexture));
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
    textureIn(first.result).addEventListener('dispose', onDispose);

    first.unmount();
    await flushMicrotasks();
    const disposedWhileHeld = onDispose.mock.calls.length;
    second.unmount();
    await flushMicrotasks();

    expect(disposedWhileHeld).toBe(0);
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it('keeps the next copy of a source when a released copy aborts after it is built', async () => {
    const texture = textureOf();
    let abortReleased: (error: unknown) => void = () => {};
    const run = vi
      .spyOn(inThreadJobRunner, 'run')
      .mockImplementationOnce(() => new Promise((_resolve, reject) => (abortReleased = reject)));
    const released = renderHook(() => useRuntimeAtlasTexture(slotOf(texture), SOURCE));
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    released.unmount();
    await flushMicrotasks();
    const next = await builtCopy(texture);

    abortReleased(new DOMException('The worker job was aborted', 'AbortError'));
    await new Promise((settle) => setTimeout(settle));
    next.rerender();

    expect(next.result.current).toBeInstanceOf(THREE.DataTexture);
  });

  it('disposes a copy whose build lands after its last run released it', async () => {
    const texture = textureOf();
    let land: (padded: imagePixels.ImagePixels) => void = () => {};
    const run = vi
      .spyOn(inThreadJobRunner, 'run')
      .mockImplementationOnce(() => new Promise((resolve) => (land = resolve)));
    const disposed = vi.spyOn(THREE.DataTexture.prototype, 'dispose');
    const released = renderHook(() => useRuntimeAtlasTexture(slotOf(texture), SOURCE));
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    released.unmount();
    await flushMicrotasks();

    land({ data: new Uint8Array(4 * 4 * 4), width: 4, height: 4 });
    await new Promise((settle) => setTimeout(settle));

    expect(disposed).toHaveBeenCalledTimes(1);
  });

  it('reads the pixels once for two padded sources of one texture', async () => {
    const texture = textureOf();
    const read = vi.spyOn(imagePixels, 'readImagePixels');

    await builtCopy(texture);
    await builtCopy(texture, { ...SOURCE, margins: { x: 1, y: 1 } });

    expect(read).toHaveBeenCalledTimes(1);
  });
  it('keeps the copy it showed while the next version builds, and disposes it once that lands', async () => {
    const texture = textureOf();
    const hook = await builtCopy(texture);
    const shown = textureIn(hook.result);
    const onDispose = vi.fn();
    shown.addEventListener('dispose', onDispose);
    let land: (padded: imagePixels.ImagePixels) => void = () => {};
    const run = vi
      .spyOn(inThreadJobRunner, 'run')
      .mockImplementationOnce(() => new Promise((resolve) => (land = resolve)));

    texture.needsUpdate = true;
    hook.rerender();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    const whileBuilding = [hook.result.current, onDispose.mock.calls.length];
    land({ data: new Uint8Array(4 * 4 * 4), width: 4, height: 4 });
    await vi.waitFor(() => expect(hook.result.current).not.toBe(shown));
    await flushMicrotasks();

    expect(whileBuilding).toEqual([shown, 0]);
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it('counts texture work until the commit that shows the copy', async () => {
    let land: (padded: imagePixels.ImagePixels) => void = () => {};
    const run = vi
      .spyOn(inThreadJobRunner, 'run')
      .mockImplementationOnce(() => new Promise((resolve) => (land = resolve)));
    const texture = textureOf();
    const hook = renderHook(() => useRuntimeAtlasTexture(slotOf(texture), SOURCE));
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    const whileBuilding = textureWork.pending();

    land({ data: new Uint8Array(4 * 4 * 4), width: 4, height: 4 });
    await flushMicrotasks();
    const landedNotShown = [hook.result.current, textureWork.pending()];
    await vi.waitFor(() => expect(hook.result.current).toBeInstanceOf(THREE.DataTexture));

    expect([whileBuilding, landedNotShown, textureWork.pending()]).toEqual([1, ['building', 1], 0]);
  });
});
