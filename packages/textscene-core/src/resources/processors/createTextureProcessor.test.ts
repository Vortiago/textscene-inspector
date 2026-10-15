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
import { createTextureFromBuffer, importDecodedImage } from '../formats/image/textureProcessing';
import { DependencyGraph } from '../dependencyGraph';
import { sourceColorSpace } from '../textures/sourceColorSpace';
import { arrayBufferOf, png, vp8l, webp } from '../formats/image/testing/imageBytes';

vi.mock('../formats/image/textureProcessing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../formats/image/textureProcessing')>();
  // Real `getMimeType` / `isTexturePath`. Only the decode is faked.
  return { ...actual, createTextureFromBuffer: vi.fn() };
});

const decode = vi.mocked(createTextureFromBuffer);

/** The real import of a blank decoded image, so the sidecar's mip chain and format still land. */
const decodeBlank: typeof createTextureFromBuffer = async (_data, _mimeType, imported) =>
  importDecodedImage(new THREE.Texture(), imported);

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
  const dependencies = new DependencyGraph();
  const loaded = vi.fn();
  const failed = vi.fn();
  eventBus.on('texture', 'loaded', loaded);
  eventBus.on('texture', 'failed', failed);
  return {
    fileEventBus,
    eventBus,
    loaded,
    failed,
    dependencies,
    processor: createTextureProcessor(fileEventBus, eventBus, dependencies),
  };
}

describe('createTextureProcessor', () => {
  beforeEach(() => {
    decode.mockClear();
    decode.mockImplementation(decodeBlank);
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

    expect(decode.mock.calls[0]![3]).toBe(eventBus.getThreeManager());
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

  it('fails a request for a non-image file without decoding it', async () => {
    // The byte bus is shared: every processor sees every arrival, and the gate
    // is what keeps a GLB, or a Radiance `.hdr`, out of the image decoder.
    const hdrPath = 'res://backgrounds/sky.hdr';
    const { processor, loaded, failed } = harness({ [hdrPath]: bytes() });

    processor.request(hdrPath);
    await flush();

    expect(decode).not.toHaveBeenCalled();
    expect(loaded).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledWith(hdrPath, expect.any(Error));
  });

  it('fails an image path whose bytes came back as text, without decoding them', async () => {
    // A host that answers a missing file with an HTML 404 body: text is not
    // something the image decoder can be handed.
    const { processor, loaded, failed } = harness({ [PNG_PATH]: '<!doctype html>' });

    processor.request(PNG_PATH);
    await flush();

    expect(decode).not.toHaveBeenCalled();
    expect(loaded).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledWith(PNG_PATH, expect.any(Error));
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

const SIDECAR_PATH = `${PNG_PATH}.import`;

/** A `texture` importer sidecar with `params` lines. */
function textureSidecar(...params: string[]): string {
  return ['[remap]', '', 'importer="texture"', '', '[params]', '', ...params].join('\n');
}

/** The colour space a `source_color` slot reads the texture at `PNG_PATH` in, served `files`. */
async function slotColorSpaceOf(files: Record<string, ArrayBuffer | string>): Promise<THREE.ColorSpace> {
  const { processor } = harness(files);
  processor.request(PNG_PATH);
  await flush();
  return sourceColorSpace(processor.getCached(PNG_PATH)!);
}

const GREY_PNG = arrayBufferOf(png(0));

describe('createTextureProcessor: the import format of an image file', () => {
  beforeEach(() => {
    decode.mockImplementation(decodeBlank);
  });

  it('reads a greyscale PNG with no sidecar raw, as a fresh lossless import does', async () => {
    expect(await slotColorSpaceOf({ [PNG_PATH]: GREY_PNG })).toBe(THREE.NoColorSpace);
  });

  it.each(['compress/mode=0', 'compress/mode=1', 'compress/mode=3'])(
    'reads a greyscale PNG raw under %s, which keeps the L8 format',
    async (mode) => {
      const sidecar = textureSidecar(mode);
      expect(await slotColorSpaceOf({ [PNG_PATH]: GREY_PNG, [SIDECAR_PATH]: sidecar })).toBe(
        THREE.NoColorSpace
      );
    }
  );

  it.each(['compress/mode=2', 'compress/mode=4'])(
    'reads a greyscale PNG as sRGB under %s, which compresses it to a format with an sRGB view',
    async (mode) => {
      const sidecar = textureSidecar(mode);
      expect(await slotColorSpaceOf({ [PNG_PATH]: GREY_PNG, [SIDECAR_PATH]: sidecar })).toBe(
        THREE.SRGBColorSpace
      );
    }
  );

  it('reads a greyscale PNG raw when only the 3D detection would compress it', async () => {
    const sidecar = textureSidecar('compress/mode=0', 'detect_3d/compress_to=1');
    expect(await slotColorSpaceOf({ [PNG_PATH]: GREY_PNG, [SIDECAR_PATH]: sidecar })).toBe(
      THREE.NoColorSpace
    );
  });

  it('reads a greyscale-with-alpha PNG raw', async () => {
    expect(await slotColorSpaceOf({ [PNG_PATH]: arrayBufferOf(png(4)) })).toBe(THREE.NoColorSpace);
  });

  it.each([
    ['an RGB PNG', png(2)],
    ['a grey-palette PNG', png(3, { extraChunks: ['PLTE'] })],
  ])('reads %s as sRGB in every mode', async (_name, image) => {
    for (const mode of [0, 1, 2, 3, 4]) {
      const sidecar = textureSidecar(`compress/mode=${mode}`);
      const files = { [PNG_PATH]: arrayBufferOf(image), [SIDECAR_PATH]: sidecar };
      expect(await slotColorSpaceOf(files)).toBe(THREE.SRGBColorSpace);
    }
  });

  it('reads a WebP as sRGB', async () => {
    const { processor } = harness({ 'res://art/tile.webp': arrayBufferOf(webp('VP8L', vp8l(false))) });
    processor.request('res://art/tile.webp');
    await flush();
    expect(sourceColorSpace(processor.getCached('res://art/tile.webp')!)).toBe(THREE.SRGBColorSpace);
  });

  it('reads a sidecar of another importer as no sidecar (edge case)', async () => {
    const sidecar = textureSidecar('compress/mode=2').replace('"texture"', '"3d_texture"');
    expect(await slotColorSpaceOf({ [PNG_PATH]: GREY_PNG, [SIDECAR_PATH]: sidecar })).toBe(
      THREE.NoColorSpace
    );
  });

  it('records the sidecar read, so creating, editing or deleting it reloads the texture', async () => {
    const { processor, dependencies } = harness({ [PNG_PATH]: GREY_PNG });
    processor.request(PNG_PATH);
    await flush();
    expect(dependencies.release(SIDECAR_PATH)).toEqual([{ busType: 'texture', key: PNG_PATH }]);
  });
});

/** The texture at `PNG_PATH`, served `files`. */
async function loadedTexture(files: Record<string, ArrayBuffer | string>): Promise<THREE.Texture> {
  const { processor } = harness(files);
  processor.request(PNG_PATH);
  await flush();
  return processor.getCached(PNG_PATH)!;
}

describe('createTextureProcessor: the mip chain of an image file', () => {
  beforeEach(() => {
    decode.mockImplementation(decodeBlank);
  });

  it('gives an image with no sidecar no mip chain, as the Detect preset imports it', async () => {
    const texture = await loadedTexture({ [PNG_PATH]: GREY_PNG });
    expect([texture.generateMipmaps, texture.minFilter]).toEqual([false, THREE.LinearFilter]);
  });

  it('keeps the mip chain of an image whose sidecar generates mipmaps', async () => {
    const sidecar = textureSidecar('mipmaps/generate=true');
    const texture = await loadedTexture({ [PNG_PATH]: GREY_PNG, [SIDECAR_PATH]: sidecar });
    expect([texture.generateMipmaps, texture.minFilter]).toEqual([true, THREE.LinearMipmapLinearFilter]);
  });

  it('drops the mip chain under a sidecar of another importer, which reads as no sidecar (edge case)', async () => {
    const sidecar = textureSidecar('mipmaps/generate=true').replace('"texture"', '"3d_texture"');
    const texture = await loadedTexture({ [PNG_PATH]: GREY_PNG, [SIDECAR_PATH]: sidecar });
    expect(texture.generateMipmaps).toBe(false);
  });

  it('gives an image whose header names no format the mip chain its sidecar asks for', async () => {
    const unreadHeader = arrayBufferOf(new Uint8Array([1, 2, 3]));
    const sidecar = textureSidecar('mipmaps/generate=true');
    const bare = await loadedTexture({ [PNG_PATH]: unreadHeader });
    const mipmapped = await loadedTexture({ [PNG_PATH]: unreadHeader, [SIDECAR_PATH]: sidecar });
    expect([bare.generateMipmaps, mipmapped.generateMipmaps]).toEqual([false, true]);
  });
});
