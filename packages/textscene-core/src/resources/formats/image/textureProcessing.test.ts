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
  decodeImagePixels,
  getMimeType,
  importDecodedImage,
  isTexturePath,
  type ImageImport,
} from './textureProcessing';
import { sourceColorSpace } from '../../textures/sourceColorSpace';
import type { ImageSourceFormat } from '../../../godot/import/imageSourceFormat';
import {
  DEFAULT_TEXTURE_IMPORT,
  TextureCompressMode,
  type TextureImportOptions,
} from '../../../godot/import/textureImport';

/** An image in `source` format under its import sidecar's `options`, the rest at their defaults. */
function imported(
  source: ImageSourceFormat | null,
  options: Partial<TextureImportOptions> = {}
): ImageImport {
  return { source, options: { ...DEFAULT_TEXTURE_IMPORT, ...options } };
}

const fakeLoader = vi.hoisted(() => ({
  mode: 'success' as 'success' | 'error',
  /** The image a successful load decodes to: none, or raw RGBA8 pixels. */
  image: null as { data: Uint8Array; width: number; height: number } | null,
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
        onLoad(new actual.Texture(fakeLoader.image ?? undefined));
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

  describe('the alpha-border pass', () => {
    /** A decoded image whose transparent texel has a partial-alpha neighbour to take RGB from. */
    const softEdge = { data: new Uint8Array([255, 255, 255, 0, 10, 20, 30, 128]), width: 2, height: 1 };

    afterEach(() => {
      fakeLoader.image = null;
    });

    it('runs on an RGBA8 source with soft edges', async () => {
      fakeLoader.image = softEdge;
      const texture = await createTextureFromBuffer(data, 'image/png', imported('RGBA8'));
      expect(Array.from((texture.image as { data: Uint8Array }).data).slice(0, 3)).toEqual([10, 20, 30]);
    });

    it('runs on a source no loader header names, as on any image with alpha (edge case)', async () => {
      fakeLoader.image = softEdge;
      const texture = await createTextureFromBuffer(data, 'image/png', imported(null));
      expect(Array.from((texture.image as { data: Uint8Array }).data).slice(0, 3)).toEqual([10, 20, 30]);
    });

    it('skips a greyscale-with-alpha source, as Godot fixes only RGBA8', async () => {
      fakeLoader.image = softEdge;
      const texture = await createTextureFromBuffer(data, 'image/png', imported('LumAlpha8'));
      expect(texture.image).toBe(softEdge);
    });

    it('skips a JPEG, which has no alpha to fix', async () => {
      fakeLoader.image = softEdge;
      const texture = await createTextureFromBuffer(data, 'image/jpeg', imported('RGB8'));
      expect(texture.image).toBe(softEdge);
    });

    /** The PNG texture a decoded image of one row of `[r, g, b, a]` texels yields. */
    function decodeRow(texels: number[][]): Promise<THREE.Texture> {
      fakeLoader.image = { data: new Uint8Array(texels.flat()), width: texels.length, height: 1 };
      return createTextureFromBuffer(data, 'image/png', imported('RGBA8'));
    }

    const bytesOf = (texture: THREE.Texture) => Array.from((texture.image as { data: Uint8Array }).data);

    it('rewrites the RGB behind alpha 0 on an image with soft, partial-alpha edges', async () => {
      const fixed = await decodeRow([
        [255, 255, 255, 0],
        [10, 20, 30, 128],
      ]);
      expect(bytesOf(fixed)).toEqual([10, 20, 30, 0, 10, 20, 30, 128]);
    });

    it("leaves the decoded image's shared bytes as they were", async () => {
      await decodeRow([
        [255, 255, 255, 0],
        [10, 20, 30, 128],
      ]);
      expect(Array.from(fakeLoader.image!.data)).toEqual([255, 255, 255, 0, 10, 20, 30, 128]);
    });

    it('keeps the RGB of a transparent texel with no source within the radius', async () => {
      const fixed = await decodeRow([
        [10, 20, 30, 255],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [7, 7, 7, 0],
      ]);
      expect(bytesOf(fixed).slice(20, 24)).toEqual([7, 7, 7, 0]);
    });
  });

  it('resolves with a texture whose colorSpace is sRGB', async () => {
    const texture = await createTextureFromBuffer(data, 'image/png', imported('RGBA8'));
    expect(texture).toBeInstanceOf(THREE.Texture);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it("leaves wrapping at three's clamp-to-edge default on both axes", async () => {
    // The loader ships the shared cache entry with three's own default, NOT
    // Repeat. Godot has two defaults for one image (`BaseMaterial3D` repeat,
    // `CanvasItem` clamp), so neither belongs on the shared entry. Each
    // consumer states its own at bind time (`applyTextureState.ts`).
    const texture = await createTextureFromBuffer(data, 'image/png', imported('RGBA8'));
    expect(texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
  });

  it('wraps the buffer in a blob with the given MIME type and loads it via blob URL', async () => {
    await createTextureFromBuffer(data, 'image/webp', imported('RGBA8'));

    expect(createSpy).toHaveBeenCalledTimes(1);
    const blob = createSpy.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe('image/webp');
    expect(blob.size).toBe(4);

    const blobUrl = createSpy.mock.results[0]!.value as string;
    expect(fakeLoader.lastUrl).toBe(blobUrl);
  });

  it('revokes the blob URL after a successful load', async () => {
    await createTextureFromBuffer(data, 'image/png', imported('RGBA8'));
    const blobUrl = createSpy.mock.results[0]!.value as string;
    expect(revokeSpy).toHaveBeenCalledWith(blobUrl);
  });

  it('rejects with the decode-failure contract message on loader error', async () => {
    fakeLoader.mode = 'error';
    await expect(createTextureFromBuffer(data, 'image/png', imported('RGBA8'))).rejects.toThrow(
      'Failed to decode texture'
    );
  });

  it('revokes the blob URL even when decoding fails', async () => {
    fakeLoader.mode = 'error';
    await createTextureFromBuffer(data, 'image/png', imported('RGBA8')).catch(() => undefined);
    const blobUrl = createSpy.mock.results[0]!.value as string;
    expect(revokeSpy).toHaveBeenCalledWith(blobUrl);
  });

  it('forwards the optional LoadingManager to the TextureLoader', async () => {
    const manager = new THREE.LoadingManager();
    await createTextureFromBuffer(data, 'image/png', imported('RGBA8'), manager);
    expect(fakeLoader.lastManager).toBe(manager);
  });

  it('constructs the TextureLoader without a manager when none is given', async () => {
    await createTextureFromBuffer(data, 'image/png', imported('RGBA8'));
    expect(fakeLoader.lastManager).toBeUndefined();
  });
});

describe('createTextureFromBuffer: the import texel passes', () => {
  const data = new Uint8Array([1, 2, 3, 4]).buffer;

  /** Decodes a one-row image of `[r, g, b, a]` texels under `source` and `options`. */
  async function importedRow(
    texels: number[][],
    source: ImageSourceFormat | null,
    options: Partial<TextureImportOptions> = {}
  ): Promise<{ texture: THREE.Texture; decoded: { data: Uint8Array; width: number; height: number } }> {
    const decoded = { data: new Uint8Array(texels.flat()), width: texels.length, height: 1 };
    fakeLoader.image = decoded;
    return { texture: await createTextureFromBuffer(data, 'image/png', imported(source, options)), decoded };
  }

  const bytesOf = (texture: THREE.Texture) => Array.from((texture.image as { data: Uint8Array }).data);

  beforeEach(() => {
    fakeLoader.mode = 'success';
  });

  afterEach(() => {
    fakeLoader.image = null;
  });

  it('rewrites the RGB behind alpha 0 and leaves the decoded bytes as they were', async () => {
    const { texture, decoded } = await importedRow(
      [
        [255, 255, 255, 0],
        [10, 20, 30, 128],
      ],
      'RGBA8'
    );
    expect([bytesOf(texture), [...decoded.data]]).toEqual([
      [10, 20, 30, 0, 10, 20, 30, 128],
      [255, 255, 255, 0, 10, 20, 30, 128],
    ]);
  });

  it('keeps the RGB of a transparent texel with no source within the radius', async () => {
    const opaqueThenFarTransparent = [[10, 20, 30, 255], ...Array(4).fill([0, 0, 0, 0]), [7, 7, 7, 0]];
    const { texture } = await importedRow(opaqueThenFarTransparent, 'RGBA8');
    expect(bytesOf(texture).slice(20, 24)).toEqual([7, 7, 7, 0]);
  });

  it('skips the alpha-border pass when the sidecar turns it off', async () => {
    const { texture, decoded } = await importedRow(
      [
        [255, 255, 255, 0],
        [10, 20, 30, 128],
      ],
      'RGBA8',
      {
        fixAlphaBorder: false,
      }
    );
    expect(texture.image).toBe(decoded);
  });

  it('premultiplies an RGBA8 image after the alpha-border pass', async () => {
    const { texture } = await importedRow(
      [
        [255, 255, 255, 0],
        [200, 100, 50, 128],
      ],
      'RGBA8',
      {
        premultAlpha: true,
      }
    );
    expect(bytesOf(texture)).toEqual([0, 0, 0, 0, 100, 50, 25, 128]);
  });

  it('premultiplies no greyscale-with-alpha image, as Godot premultiplies only RGBA8', async () => {
    const { texture, decoded } = await importedRow([[200, 200, 200, 128]], 'LumAlpha8', {
      premultAlpha: true,
    });
    expect(texture.image).toBe(decoded);
  });

  it('inverts the green channel of a normal map in any format', async () => {
    const { texture } = await importedRow([[128, 0, 255, 255]], 'RGB8', { invertNormalY: true });
    expect(bytesOf(texture)).toEqual([128, 255, 255, 255]);
  });

  it('keeps only red and green of a normal map VRAM compressed to RGTC', async () => {
    const { texture } = await importedRow([[200, 100, 50, 128]], 'RGBA8', {
      mode: TextureCompressMode.VramCompressed,
      normalMap: true,
      fixAlphaBorder: false,
    });
    expect(bytesOf(texture)).toEqual([200, 100, 0, 255]);
  });

  it('keeps every channel of a normal map compressed at high quality, to BPTC (edge case)', async () => {
    const { texture, decoded } = await importedRow([[200, 100, 50, 255]], 'RGB8', {
      mode: TextureCompressMode.VramCompressed,
      highQuality: true,
      normalMap: true,
    });
    expect(texture.image).toBe(decoded);
  });

  it('keeps the sampling of the texture it replaces', async () => {
    const { texture } = await importedRow([[1, 2, 3, 255]], 'RGB8', { invertNormalY: true, mipmaps: true });
    expect([texture.minFilter, texture.generateMipmaps]).toEqual([THREE.LinearMipmapLinearFilter, true]);
  });

  it('returns the decoded texture when no pass changes a byte', async () => {
    const { texture, decoded } = await importedRow([[1, 2, 3, 255]], 'RGBA8', { premultAlpha: true });
    expect(texture.image).toBe(decoded);
  });

  it('returns the decoded texture when its pixels cannot be read (edge case)', async () => {
    fakeLoader.image = null;
    const texture = await createTextureFromBuffer(
      data,
      'image/png',
      imported('RGBA8', { premultAlpha: true })
    );
    expect(texture.image).toBeNull();
  });
});

describe('importDecodedImage', () => {
  /** The `userData` key `recordGodotFormat` writes. */
  const GODOT_FORMAT = 'textsceneGodotFormat';
  const vram = { mode: TextureCompressMode.VramCompressed, fixAlphaBorder: false };

  /** A texture of raw RGBA8 `texels` in one row. */
  const rgbaTexture = (texels: number[]) =>
    new THREE.Texture({ data: new Uint8Array(texels), width: texels.length / 4, height: 1 });

  it('drops the mip chain of an import without mipmaps', () => {
    const texture = importDecodedImage(new THREE.Texture(), imported('RGBA8'));
    expect([texture.minFilter, texture.generateMipmaps]).toEqual([THREE.LinearFilter, false]);
  });

  it('keeps the mip chain of an import that generates mipmaps', () => {
    const texture = importDecodedImage(new THREE.Texture(), imported('RGBA8', { mipmaps: true }));
    expect(texture.generateMipmaps).toBe(true);
  });

  it('records the format a colour slot reads the import through', () => {
    const texture = importDecodedImage(new THREE.Texture(), imported('Lum8'));
    expect(sourceColorSpace(texture)).toBe(THREE.NoColorSpace);
  });

  it('disposes the decoded texture that the rewritten bytes replace', async () => {
    const disposed = vi.fn();
    const decoded = new THREE.Texture({ data: new Uint8Array([128, 0, 255, 255]), width: 1, height: 1 });
    decoded.addEventListener('dispose', disposed);
    importDecodedImage(decoded, imported('RGB8', { invertNormalY: true }));
    expect(disposed).toHaveBeenCalledOnce();
  });

  it('records DXT1 for a VRAM-compressed RGBA8 image whose texels are all opaque', () => {
    const texture = importDecodedImage(rgbaTexture([9, 9, 9, 255]), imported('RGBA8', vram));
    expect(texture.userData[GODOT_FORMAT]).toBe('DXT1 RGB8');
  });

  it('records DXT5 for a VRAM-compressed RGBA8 image with a translucent texel', () => {
    const texture = importDecodedImage(rgbaTexture([9, 9, 9, 255, 9, 9, 9, 128]), imported('RGBA8', vram));
    expect(texture.userData[GODOT_FORMAT]).toBe('DXT5 RGBA8');
  });

  it('records DXT5 for a VRAM-compressed RGBA8 image whose pixels cannot be read (edge case)', () => {
    const texture = importDecodedImage(new THREE.Texture(), imported('RGBA8', vram));
    expect(texture.userData[GODOT_FORMAT]).toBe('DXT5 RGBA8');
  });

  it('records no format for an image whose header names none (edge case)', () => {
    const texture = importDecodedImage(new THREE.Texture(), imported(null));
    expect(sourceColorSpace(texture)).toBe(THREE.SRGBColorSpace);
  });
});

describe('createTextureFromBuffer: the SVG import scale', () => {
  const data = new Uint8Array([1, 2, 3, 4]).buffer;
  const drawImage = vi.fn();

  beforeEach(() => {
    fakeLoader.mode = 'success';
    fakeLoader.image = { data: new Uint8Array(4 * 3 * 2), width: 3, height: 2 };
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = createElement(tag);
      // Only a 2D context: a WebGL one would be cached as the shared pixel-readback context.
      const getContext = (kind: string) => (kind === '2d' ? { drawImage } : null);
      if (tag === 'canvas') Object.assign(element, { getContext });
      return element;
    });
  });

  afterEach(() => {
    fakeLoader.image = null;
    drawImage.mockClear();
    vi.restoreAllMocks();
  });

  it('draws an SVG at its scale times its own size, rounded', async () => {
    const texture = await createTextureFromBuffer(
      data,
      'image/svg+xml',
      imported('RGBA8', { svgScale: 2.5 })
    );
    const canvas = texture.image as HTMLCanvasElement;
    expect([canvas.width, canvas.height, drawImage.mock.calls[0]!.slice(3)]).toEqual([8, 5, [8, 5]]);
  });

  it('keeps an SVG at scale 1 as decoded', async () => {
    const texture = await createTextureFromBuffer(data, 'image/svg+xml', imported('RGBA8'));
    expect(drawImage).not.toHaveBeenCalled();
    expect((texture.image as { width: number }).width).toBe(3);
  });

  it('scales no raster image, whatever its sidecar says (edge case)', async () => {
    await createTextureFromBuffer(data, 'image/png', imported('RGBA8', { svgScale: 2 }));
    expect(drawImage).not.toHaveBeenCalled();
  });
});

describe('decodeImagePixels', () => {
  const data = new Uint8Array([1, 2, 3, 4]).buffer;

  beforeEach(() => {
    fakeLoader.mode = 'success';
    fakeLoader.image = null;
  });

  afterEach(() => {
    fakeLoader.image = null;
  });

  it('resolves with the decoded RGBA8 pixels, top row first', async () => {
    // A transparent texel keeps its RGB: no alpha-border pass runs, as in Godot's layered importer.
    fakeLoader.image = { data: new Uint8Array([9, 8, 7, 0, 1, 2, 3, 255]), width: 2, height: 1 };
    const pixels = await decodeImagePixels(data, 'image/png');
    expect(pixels).toMatchObject({ width: 2, height: 1 });
    expect([...pixels.data]).toEqual([9, 8, 7, 0, 1, 2, 3, 255]);
  });

  it('rejects with the decode-failure message on loader error', async () => {
    fakeLoader.mode = 'error';
    await expect(decodeImagePixels(data, 'image/png')).rejects.toThrow('Failed to decode texture');
  });

  it('rejects an image whose pixels cannot be read (edge case)', async () => {
    await expect(decodeImagePixels(data, 'image/png')).rejects.toThrow('Failed to read the pixels');
  });
});
