/**
 * The channel repack (Godot ALPHA strength → three.js BLUE) and the pixel read
 * that feeds it.
 *
 * WHAT THIS FILE CANNOT PROVE: happy-dom has no rasterizer — `getContext('2d')`
 * returns null — so the canvas readback that real, image-backed textures take is
 * unreachable here. Every test below either injects a reader or asserts the
 * no-canvas degradation, and the canvas path itself is covered by the
 * `material-anisotropy-flowmap` golden, which renders a real PNG flowmap through
 * a real browser (scripts/visual/scenes.mjs). A test that "passed" against a
 * happy-dom canvas stub would prove nothing about either.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  readFlowmapPixels,
  repackAnisotropyFlowmap,
  type FlowmapPixels,
} from './repackFlowmap';

/** A decoded-image-shaped object: dimensions but no raw `.data`. */
function imageLike(width = 2, height = 1): Record<string, unknown> {
  return { width, height, naturalWidth: width, naturalHeight: height };
}

describe('readFlowmapPixels', () => {
  it('returns a DataTexture image buffer as-is, no canvas involved', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const pixels = readFlowmapPixels({ data, width: 2, height: 1 });
    expect(pixels).toEqual({ data, width: 2, height: 1 });
    expect(pixels!.data).toBe(data); // no copy at read time
  });

  it('reads a decoded image through a 2D canvas when one is available', () => {
    // happy-dom returns null from getContext('2d'), so the canvas is stubbed to
    // pin the CALL SHAPE (drawImage + getImageData over the full image) — not
    // the pixels, which only a real rasterizer produces.
    const drawImage = vi.fn();
    const getImageData = vi.fn(() => ({ data: new Uint8ClampedArray(2 * 1 * 4) }));
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage, getImageData }) };
    const createElement = vi
      .spyOn(globalThis.document, 'createElement')
      .mockReturnValue(canvas as unknown as HTMLElement);

    try {
      const image = imageLike();
      const pixels = readFlowmapPixels(image);
      expect(pixels?.width).toBe(2);
      expect(pixels?.height).toBe(1);
      expect(canvas.width).toBe(2);
      expect(canvas.height).toBe(1);
      expect(drawImage).toHaveBeenCalledWith(image, 0, 0);
      expect(getImageData).toHaveBeenCalledWith(0, 0, 2, 1);
    } finally {
      createElement.mockRestore();
    }
  });

  it('returns undefined for a decoded image when no 2D context exists (happy-dom)', () => {
    expect(readFlowmapPixels(imageLike())).toBeUndefined();
  });

  it('returns undefined when getImageData throws (cross-origin tainted canvas)', () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: () => undefined,
        getImageData: () => {
          throw new DOMException('Tainted canvases may not be read', 'SecurityError');
        },
      }),
    };
    const createElement = vi
      .spyOn(globalThis.document, 'createElement')
      .mockReturnValue(canvas as unknown as HTMLElement);
    try {
      expect(readFlowmapPixels(imageLike())).toBeUndefined();
    } finally {
      createElement.mockRestore();
    }
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
    const texture = new THREE.Texture(imageLike() as unknown as HTMLImageElement);
    const read = vi.fn(
      (): FlowmapPixels => ({ data: new Uint8ClampedArray(SOURCE), width: 2, height: 1 })
    );

    const out = repackAnisotropyFlowmap(texture, read)!;

    expect(read).toHaveBeenCalledWith(texture.image);
    const data = (out.image as { data: Uint8Array }).data;
    expect(data).toBeInstanceOf(Uint8Array);
    expect(Array.from(data)).toEqual([128, 128, 200, 200, 10, 20, 30, 30]);
    expect(out.image.width).toBe(2);
    expect(out.image.height).toBe(1);
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

  it('returns undefined when no pixels can be read, so the caller wires no map', () => {
    const texture = new THREE.Texture(imageLike() as unknown as HTMLImageElement);
    // Default reader under happy-dom: no 2D context, nothing readable.
    expect(repackAnisotropyFlowmap(texture)).toBeUndefined();
    expect(repackAnisotropyFlowmap(texture, () => undefined)).toBeUndefined();
  });
});
