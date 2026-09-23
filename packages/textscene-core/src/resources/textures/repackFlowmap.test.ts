/**
 * The channel repack (Godot alpha strength to three.js blue) and its pixel read.
 * happy-dom's `getContext('2d')` returns null, so each test injects a reader or
 * asserts the no-canvas case. The `material-anisotropy-flowmap` golden
 * (scripts/visual/scenes.mjs) covers the canvas path.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  readFlowmapPixels,
  repackAnisotropyFlowmap,
  type FlowmapPixels,
} from './repackFlowmap';

/** A decoded-image-shaped object: dimensions but no raw `.data`. */
function imageLike(width = 2, height = 1): HTMLImageElement {
  return { width, height, naturalWidth: width, naturalHeight: height } as HTMLImageElement;
}

/**
 * Stands in for the 2D canvas happy-dom lacks. It pins only the call shape: real
 * pixels are the golden's job.
 */
function stubCanvas(ctx: object): { width: number; height: number } {
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  vi.spyOn(globalThis.document, 'createElement').mockReturnValue(canvas as unknown as HTMLElement);
  return canvas;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('readFlowmapPixels', () => {
  it('returns a DataTexture image buffer as-is, no canvas involved', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const pixels = readFlowmapPixels({ data, width: 2, height: 1 });
    expect(pixels).toEqual({ data, width: 2, height: 1 });
    expect(pixels!.data).toBe(data); // No copy at read time.
  });

  it('reads a decoded image through a 2D canvas when one is available', () => {
    const drawImage = vi.fn();
    const getImageData = vi.fn(() => ({ data: new Uint8ClampedArray(2 * 1 * 4) }));
    const canvas = stubCanvas({ drawImage, getImageData });

    const image = imageLike();
    const pixels = readFlowmapPixels(image);

    expect(pixels?.width).toBe(2);
    expect(pixels?.height).toBe(1);
    expect(canvas.width).toBe(2);
    expect(canvas.height).toBe(1);
    expect(drawImage).toHaveBeenCalledWith(image, 0, 0);
    expect(getImageData).toHaveBeenCalledWith(0, 0, 2, 1);
  });

  it('returns undefined for a decoded image when no 2D context exists (happy-dom)', () => {
    expect(readFlowmapPixels(imageLike())).toBeUndefined();
  });

  it('returns undefined when getImageData throws (cross-origin tainted canvas)', () => {
    stubCanvas({
      drawImage: () => undefined,
      getImageData: () => {
        throw new DOMException('Tainted canvases may not be read', 'SecurityError');
      },
    });
    expect(readFlowmapPixels(imageLike())).toBeUndefined();
  });

  it('returns undefined for a missing or not-yet-decoded image', () => {
    expect(readFlowmapPixels(undefined)).toBeUndefined();
    expect(readFlowmapPixels({ width: 0, height: 0 })).toBeUndefined();
  });
});

describe('repackAnisotropyFlowmap', () => {
  /** Two pixels: neutral direction, blue unused, distinct alpha strengths. */
  const SOURCE = new Uint8Array([128, 128, 0, 200, 10, 20, 0, 30]);

  function dataTexture(): THREE.Texture {
    const texture = new THREE.DataTexture(new Uint8Array(SOURCE), 2, 1, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return texture;
  }

  it('copies ALPHA into BLUE for a DataTexture flowmap and leaves the source untouched', () => {
    const source = dataTexture();
    const out = repackAnisotropyFlowmap(source)!;

    const data = (out.image as { data: Uint8Array }).data;
    expect(Array.from(data)).toEqual([128, 128, 200, 200, 10, 20, 30, 30]);
    // The cached input is shared by every consumer of that flowmap path.
    expect(Array.from((source.image as { data: Uint8Array }).data)).toEqual(Array.from(SOURCE));
    expect(out.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('repacks image-backed pixels the reader supplies (the real-asset path)', () => {
    // Stands in for what a real browser's getImageData returns for a decoded
    // PNG: a Uint8ClampedArray, no `.data` on the texture image itself.
    const texture = new THREE.Texture(imageLike());
    const read = vi.fn(
      (): FlowmapPixels => ({ data: new Uint8ClampedArray(SOURCE), width: 2, height: 1 })
    );

    const out = repackAnisotropyFlowmap(texture, read)!;

    expect(read).toHaveBeenCalledWith(texture.image);
    // `repackAnisotropyFlowmap` returns `THREE.Texture | undefined`, but always a
    // `DataTexture`, whose `.image` carries `data`, `width` and `height`.
    const image = out.image as { data: Uint8Array; width: number; height: number };
    expect(image.data).toBeInstanceOf(Uint8Array);
    expect(Array.from(image.data)).toEqual([128, 128, 200, 200, 10, 20, 30, 30]);
    expect(image.width).toBe(2);
    expect(image.height).toBe(1);
  });

  it('carries the source texture sampling settings onto the repacked texture', () => {
    const source = dataTexture();
    source.wrapS = THREE.RepeatWrapping;
    source.wrapT = THREE.MirroredRepeatWrapping;
    source.magFilter = THREE.NearestFilter;
    source.minFilter = THREE.LinearFilter;
    source.flipY = false;

    const out = repackAnisotropyFlowmap(source)!;

    expect(out.wrapS).toBe(THREE.RepeatWrapping);
    expect(out.wrapT).toBe(THREE.MirroredRepeatWrapping);
    expect(out.magFilter).toBe(THREE.NearestFilter);
    expect(out.minFilter).toBe(THREE.LinearFilter);
    expect(out.flipY).toBe(false);
  });

  it('takes mipmapping from the source rather than the DataTexture default', () => {
    // A loaded image asks for mipmaps, and a DataTexture defaults to
    // generateMipmaps=false, which samples level 0 at every distance.
    const loaded = new THREE.Texture(imageLike());
    loaded.minFilter = THREE.LinearMipmapLinearFilter;
    expect(loaded.generateMipmaps).toBe(true);

    const out = repackAnisotropyFlowmap(loaded, () => ({
      data: new Uint8ClampedArray(SOURCE),
      width: 2,
      height: 1,
    }))!;

    expect(out.generateMipmaps).toBe(true);
    expect(out.minFilter).toBe(THREE.LinearMipmapLinearFilter);

    // …and a source that does not want them still gets none.
    const plain = dataTexture();
    expect(plain.generateMipmaps).toBe(false);
    expect(repackAnisotropyFlowmap(plain)!.generateMipmaps).toBe(false);
  });

  it('returns undefined when no pixels can be read, so the caller wires no map', () => {
    const texture = new THREE.Texture(imageLike());
    // Default reader under happy-dom: no 2D context, nothing readable.
    expect(repackAnisotropyFlowmap(texture)).toBeUndefined();
    expect(repackAnisotropyFlowmap(texture, () => undefined)).toBeUndefined();
  });
});
