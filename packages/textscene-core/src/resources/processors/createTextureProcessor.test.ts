/**
 * The image slice's loader-facing adapter (ADR-0031): the gate (which bytes are
 * an image) and the MIME it hands a faked decoder. happy-dom fires neither `load`
 * nor `error` on an image, so `formats/image/textureProcessing.test.ts` pins the
 * real `THREE.TextureLoader` path against a controllable fake.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { FileEventBus } from '../FileEventBus';
import { ResourceEventBus } from '../ResourceEventBus';
import { createTextureProcessor } from './createTextureProcessor';
import { createTextureFromBuffer } from '../formats/image/textureProcessing';

vi.mock('../formats/image/textureProcessing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../formats/image/textureProcessing')>();
  return {
    ...actual,
    // Real `getMimeType` / `isTexturePath`. Only the decode is faked.
    createTextureFromBuffer: vi.fn(async () => new THREE.Texture()),
  };
});

const decode = vi.mocked(createTextureFromBuffer);

/** The settle window for the byte bus → processor round trip. */
const flush = (ms = 20): Promise<unknown> => new Promise((r) => setTimeout(r, ms));

const PNG_PATH = 'res://art/tile.png';

function bytes(): ArrayBuffer {
  return new Uint8Array([1, 2, 3, 4]).buffer;
}

function harness(files: Record<string, ArrayBuffer | string>) {
  const fileEventBus = new FileEventBus({
    loadResource: vi.fn(async (path: string) => files[path] ?? null),
  });
  const eventBus = new ResourceEventBus();
  const loaded = vi.fn();
  const failed = vi.fn();
  eventBus.on('texture', 'loaded', loaded);
  eventBus.on('texture', 'failed', failed);
  return { fileEventBus, eventBus, loaded, failed, processor: createTextureProcessor(fileEventBus, eventBus) };
}

describe('createTextureProcessor', () => {
  beforeEach(() => {
    decode.mockClear();
    decode.mockImplementation(async () => new THREE.Texture());
  });

  it('decodes an image file and publishes it on the texture slot', async () => {
    const { processor, loaded } = harness({ [PNG_PATH]: bytes() });

    processor.request(PNG_PATH);
    await flush();

    expect(loaded).toHaveBeenCalledTimes(1);
    expect(loaded.mock.calls[0]![0]).toBe(PNG_PATH);
    expect(loaded.mock.calls[0]![1]).toBeInstanceOf(THREE.Texture);
    expect(processor.getCached(PNG_PATH)).toBeInstanceOf(THREE.Texture);
  });

  it('derives the MIME type from the path extension', async () => {
    const jpegPath = 'res://art/photo.jpeg';
    const { processor } = harness({ [PNG_PATH]: bytes(), [jpegPath]: bytes() });

    processor.request(PNG_PATH);
    processor.request(jpegPath);
    await flush();

    const mimeByPath = decode.mock.calls.map(([, mimeType]) => mimeType).sort();
    expect(mimeByPath).toEqual(['image/jpeg', 'image/png']);
  });

  it('forwards the bus LoadingManager so the host can remap the blob load', async () => {
    const { processor, eventBus } = harness({ [PNG_PATH]: bytes() });

    processor.request(PNG_PATH);
    await flush();

    expect(decode.mock.calls[0]![2]).toBe(eventBus.getThreeManager());
  });

  it('serves a second request from cache instead of decoding twice', async () => {
    const { processor, loaded } = harness({ [PNG_PATH]: bytes() });

    processor.request(PNG_PATH);
    await flush();
    processor.request(PNG_PATH);
    await flush();

    expect(decode).toHaveBeenCalledTimes(1);
    expect(loaded).toHaveBeenCalledTimes(2);
    expect(loaded.mock.calls[1]![1]).toBe(loaded.mock.calls[0]![1]);
  });

  it('reports a decode failure on the texture slot rather than caching a broken texture', async () => {
    decode.mockRejectedValueOnce(new Error('Failed to decode texture'));
    const { processor, failed } = harness({ [PNG_PATH]: bytes() });

    processor.request(PNG_PATH);
    await flush();

    expect(failed).toHaveBeenCalledTimes(1);
    expect((failed.mock.calls[0]![1] as Error).message).toBe('Failed to decode texture');
    expect(processor.getCached(PNG_PATH)).toBeNull();
  });

  it('leaves a non-image file to another processor', async () => {
    // The byte bus is shared: every processor sees every arrival, and the gate
    // is what keeps a GLB out of the image decoder.
    const glbPath = 'res://models/rock.glb';
    const { processor, loaded, failed } = harness({ [glbPath]: bytes() });

    processor.request(glbPath);
    await flush();

    expect(decode).not.toHaveBeenCalled();
    expect(loaded).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
  });

  it('leaves an image path whose bytes came back as text alone', async () => {
    // A host that answers a missing file with an HTML 404 body: text is not
    // something the image decoder can be handed.
    const { processor, loaded, failed } = harness({ [PNG_PATH]: '<!doctype html>' });

    processor.request(PNG_PATH);
    await flush();

    expect(decode).not.toHaveBeenCalled();
    expect(loaded).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
  });

  it('disposes the texture when its cache entry is cleared', async () => {
    const texture = new THREE.Texture();
    decode.mockResolvedValueOnce(texture);
    const disposeSpy = vi.spyOn(texture, 'dispose');
    const { processor } = harness({ [PNG_PATH]: bytes() });

    processor.request(PNG_PATH);
    await flush();
    processor.clearCache(PNG_PATH);

    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });
});
