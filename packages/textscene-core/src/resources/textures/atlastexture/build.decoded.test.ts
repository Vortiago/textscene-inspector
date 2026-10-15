/**
 * `rasterizeAtlasTexture` over a sheet that stays a decoded image. happy-dom has no WebGL2, so
 * the readback is mocked: it hands back the image's bytes, top row first.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { rasterizeAtlasTexture } from './build';
import type { AtlasTextureLayout } from './types';

const readback = vi.hoisted(() => ({ calls: 0, bytes: null as Uint8Array | null }));

vi.mock('../../formats/image/imagePixels', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../formats/image/imagePixels')>();
  return {
    ...actual,
    readImagePixels: (image: { width: number; height: number }) => {
      readback.calls += 1;
      return readback.bytes ? { data: readback.bytes, width: image.width, height: image.height } : undefined;
    },
  };
});

afterEach(() => {
  readback.calls = 0;
  readback.bytes = null;
});

/** A decoded 2x2 sheet: dimensions only, its bytes behind the readback. */
function decodedSheet(): THREE.Texture {
  return new THREE.Texture({ width: 2, height: 2 } as HTMLImageElement);
}

/** The top-right texel of a 2x2 sheet as a 1x1 crop. */
const topRight: AtlasTextureLayout = {
  width: 1,
  height: 1,
  source: { x: 1, y: 0, width: 1, height: 1 },
  dest: { x: 0, y: 0 },
};

describe('rasterizeAtlasTexture — decoded sheets', () => {
  it('crops the read-back bytes, keeping the RGB behind alpha 0', () => {
    // Rows top first: (1, 2), then (3, 4). The top-right texel is transparent with RGB 2.
    readback.bytes = new Uint8Array([1, 1, 1, 255, 2, 2, 2, 0, 3, 3, 3, 255, 4, 4, 4, 255]);

    const crop = rasterizeAtlasTexture(decodedSheet(), topRight)!;

    expect(Array.from((crop.image as { data: Uint8Array }).data)).toEqual([2, 2, 2, 0]);
    expect(crop.flipY).toBe(true);
  });

  it('reads one sheet back once for every AtlasTexture cut from it', () => {
    readback.bytes = new Uint8Array(16);
    const sheet = decodedSheet();

    rasterizeAtlasTexture(sheet, topRight);
    rasterizeAtlasTexture(sheet, { ...topRight, source: { x: 0, y: 1, width: 1, height: 1 } });

    expect(readback.calls).toBe(1);
  });

  it('returns null when the sheet cannot be read back', () => {
    expect(rasterizeAtlasTexture(decodedSheet(), topRight)).toBeNull();
  });
});
