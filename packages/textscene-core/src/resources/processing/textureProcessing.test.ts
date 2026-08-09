/**
 * Unit tests for texture processing helpers.
 *
 * `createTextureFromBuffer` cannot be exercised end-to-end here: happy-dom
 * never fires `load` OR `error` on image elements, so the real
 * `THREE.TextureLoader` path never settles (verified empirically — the
 * promise hangs). Instead, `TextureLoader` is replaced with a controllable
 * fake (partial mock of `three`) and the tests pin the function's contract:
 * blob creation with the given MIME type, sRGB color space assignment on
 * success, the "Failed to decode texture" rejection on error, and blob-URL
 * revocation on BOTH paths.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  applyAlphaBorderFix,
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

describe('applyAlphaBorderFix', () => {
  /** A 2x1 RGBA8 image: a transparent magenta texel beside an opaque grey one. */
  const needsFix = () => ({
    data: new Uint8Array([255, 0, 255, 0, 10, 20, 30, 255]),
    width: 2,
    height: 1,
  });

  it('keeps the loaded texture when its pixels are unreadable', () => {
    const texture = new THREE.Texture();
    expect(applyAlphaBorderFix(texture, () => undefined)).toBe(texture);
  });

  it('keeps the loaded texture when no transparent texel needs rewriting', () => {
    const texture = new THREE.Texture();
    const pixels = { data: new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255]), width: 2, height: 1 };
    expect(applyAlphaBorderFix(texture, () => pixels)).toBe(texture);
  });

  /**
   * A soft-edged image must come back untouched even though it HAS a texel this
   * pass would rewrite. Substituting replaces the whole image, and the pixels
   * arrive un-premultiplied from a premultiplied 8-bit store — exact only at
   * alpha 0 and 255 — so every partial texel would be degraded to repair the
   * transparent ones. Measured against Godot that is a net loss, worst on a
   * radial light falloff, which carries no opaque texel at all.
   */
  it('leaves an image carrying partial alpha alone, however much it would rewrite', () => {
    const texture = new THREE.Texture();
    const softEdged = () => ({
      // Transparent magenta (would be rewritten), a half-alpha texel, an opaque source.
      data: new Uint8Array([255, 0, 255, 0, 90, 90, 90, 128, 10, 20, 30, 255]),
      width: 3,
      height: 1,
    });
    expect(applyAlphaBorderFix(texture, softEdged)).toBe(texture);
  });

  it('still substitutes when the only alphas are 0 and 255', () => {
    const texture = new THREE.Texture();
    expect(applyAlphaBorderFix(texture, needsFix)).not.toBe(texture);
  });

  /**
   * Godot leaves a transparent texel with no opaque neighbour carrying its own
   * RGB. We never see that RGB — the premultiplied store zeroed it before the
   * readback — so substituting would publish black there. One such texel is
   * enough to make the whole substituted image wrong, even though other
   * transparent texels in the same image DO have a source and would be fixed.
   */
  it('leaves the image alone when any transparent texel is out of reach of an opaque one', () => {
    const texture = new THREE.Texture();
    const stranded = () => {
      // 7x1: a transparent texel beside an opaque one (fixable), then a run of
      // transparent texels whose last is 5 apart — beyond the radius-4 search.
      const data = new Uint8Array(7 * 4);
      data.set([255, 0, 255, 0], 0);
      data.set([10, 20, 30, 255], 4);
      return { data, width: 7, height: 1 };
    };
    expect(applyAlphaBorderFix(texture, stranded)).toBe(texture);
  });

  it('replaces the texture with one whose transparent texel carries its neighbour RGB', () => {
    const texture = new THREE.Texture();
    const fixed = applyAlphaBorderFix(texture, needsFix);

    expect(fixed).not.toBe(texture);
    const image = fixed.image as { data: Uint8Array; width: number; height: number };
    expect(Array.from(image.data)).toEqual([10, 20, 30, 0, 10, 20, 30, 255]);
    expect(image.width).toBe(2);
    expect(image.height).toBe(1);
  });

  it('carries the loaded texture sampling state onto the replacement', () => {
    const texture = new THREE.Texture();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.MirroredRepeatWrapping;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.flipY = true;
    texture.anisotropy = 4;

    const fixed = applyAlphaBorderFix(texture, needsFix);

    expect(fixed.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(fixed.wrapS).toBe(THREE.RepeatWrapping);
    expect(fixed.wrapT).toBe(THREE.MirroredRepeatWrapping);
    expect(fixed.magFilter).toBe(THREE.NearestFilter);
    expect(fixed.minFilter).toBe(THREE.NearestMipmapLinearFilter);
    expect(fixed.generateMipmaps).toBe(true);
    expect(fixed.flipY).toBe(true);
    expect(fixed.anisotropy).toBe(4);
  });
});
