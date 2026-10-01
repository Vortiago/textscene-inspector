/**
 * Texture processing helpers. happy-dom fires neither `load` nor `error` on an image, so
 * a partial mock of `three` fakes `TextureLoader`, and the tests pin the contract: the
 * blob's MIME type, sRGB on success, the "Failed to decode texture" rejection, and
 * blob-URL revocation on both paths.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  createTextureFromBuffer,
  getMimeType,
  isTexturePath,
} from './textureProcessing';

const fakeLoader = vi.hoisted(() => ({
  mode: 'success' as 'success' | 'error',
  lastUrl: undefined as string | undefined,
  lastManager: undefined as unknown,
}));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();

  class FakeTextureLoader {
    constructor(manager?: unknown) {
      fakeLoader.lastManager = manager;
    }

    load(
      url: string,
      onLoad: (texture: InstanceType<typeof actual.Texture>) => void,
      _onProgress: undefined,
      onError: (error: unknown) => void
    ): void {
      fakeLoader.lastUrl = url;
      if (fakeLoader.mode === 'success') {
        onLoad(new actual.Texture());
      } else {
        onError(new Error('decode failed'));
      }
    }
  }

  return { ...actual, TextureLoader: FakeTextureLoader };
});

describe('getMimeType', () => {
  it('maps known extensions to their MIME types', () => {
    expect(getMimeType('texture.png')).toBe('image/png');
    expect(getMimeType('texture.jpg')).toBe('image/jpeg');
    expect(getMimeType('texture.jpeg')).toBe('image/jpeg');
    expect(getMimeType('icon.svg')).toBe('image/svg+xml');
    expect(getMimeType('photo.webp')).toBe('image/webp');
  });

  it('is case-insensitive on the extension', () => {
    expect(getMimeType('TEXTURE.PNG')).toBe('image/png');
    expect(getMimeType('Photo.JpEg')).toBe('image/jpeg');
  });

  it('uses only the last extension of multi-dot names', () => {
    expect(getMimeType('atlas.v2.png')).toBe('image/png');
  });

  it('falls back to application/octet-stream for unknown or missing extensions', () => {
    expect(getMimeType('data.bin')).toBe('application/octet-stream');
    expect(getMimeType('noextension')).toBe('application/octet-stream');
    expect(getMimeType('')).toBe('application/octet-stream');
  });
});

describe('isTexturePath', () => {
  it('accepts all supported texture extensions', () => {
    expect(isTexturePath('a.png')).toBe(true);
    expect(isTexturePath('a.jpg')).toBe(true);
    expect(isTexturePath('a.jpeg')).toBe(true);
    expect(isTexturePath('a.svg')).toBe(true);
    expect(isTexturePath('a.webp')).toBe(true);
  });

  it('is case-insensitive on the extension', () => {
    expect(isTexturePath('A.JPG')).toBe(true);
    expect(isTexturePath('res://textures/Wall.PNG')).toBe(true);
  });

  it('rejects non-texture paths', () => {
    expect(isTexturePath('model.glb')).toBe(false);
    expect(isTexturePath('material.tres')).toBe(false);
    expect(isTexturePath('noextension')).toBe(false);
    expect(isTexturePath('')).toBe(false);
  });

  it('does not match when a query string trails the extension (current contract)', () => {
    expect(isTexturePath('tex.png?v=1')).toBe(false);
  });
});

describe('createTextureFromBuffer', () => {
  const data = new Uint8Array([1, 2, 3, 4]).buffer;
  let createSpy: ReturnType<typeof vi.spyOn>;
  let revokeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fakeLoader.mode = 'success';
    fakeLoader.lastUrl = undefined;
    fakeLoader.lastManager = undefined;
    createSpy = vi.spyOn(URL, 'createObjectURL');
    revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
  });

  afterEach(() => {
    createSpy.mockRestore();
    revokeSpy.mockRestore();
  });

  it('resolves with a texture whose colorSpace is sRGB', async () => {
    const texture = await createTextureFromBuffer(data, 'image/png');
    expect(texture).toBeInstanceOf(THREE.Texture);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('leaves wrapping at three\'s clamp-to-edge default on both axes', async () => {
    // The loader ships the shared cache entry with three's own default, NOT
    // Repeat. Godot has two defaults for one image (`BaseMaterial3D` repeat,
    // `CanvasItem` clamp), so neither belongs on the shared entry. Each
    // consumer states its own at bind time (`applyTextureState.ts`).
    const texture = await createTextureFromBuffer(data, 'image/png');
    expect(texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
  });

  it('wraps the buffer in a blob with the given MIME type and loads it via blob URL', async () => {
    await createTextureFromBuffer(data, 'image/webp');

    expect(createSpy).toHaveBeenCalledTimes(1);
    const blob = createSpy.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe('image/webp');
    expect(blob.size).toBe(4);

    const blobUrl = createSpy.mock.results[0]!.value as string;
    expect(fakeLoader.lastUrl).toBe(blobUrl);
  });

  it('revokes the blob URL after a successful load', async () => {
    await createTextureFromBuffer(data, 'image/png');
    const blobUrl = createSpy.mock.results[0]!.value as string;
    expect(revokeSpy).toHaveBeenCalledWith(blobUrl);
  });

  it('rejects with the decode-failure contract message on loader error', async () => {
    fakeLoader.mode = 'error';
    await expect(createTextureFromBuffer(data, 'image/png')).rejects.toThrow(
      'Failed to decode texture'
    );
  });

  it('revokes the blob URL even when decoding fails', async () => {
    fakeLoader.mode = 'error';
    await createTextureFromBuffer(data, 'image/png').catch(() => undefined);
    const blobUrl = createSpy.mock.results[0]!.value as string;
    expect(revokeSpy).toHaveBeenCalledWith(blobUrl);
  });

  it('forwards the optional LoadingManager to the TextureLoader', async () => {
    const manager = new THREE.LoadingManager();
    await createTextureFromBuffer(data, 'image/png', manager);
    expect(fakeLoader.lastManager).toBe(manager);
  });

  it('constructs the TextureLoader without a manager when none is given', async () => {
    await createTextureFromBuffer(data, 'image/png');
    expect(fakeLoader.lastManager).toBeUndefined();
  });
});
