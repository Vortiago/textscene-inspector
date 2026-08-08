/**
 * The atlas crop: a canvas of the AtlasTexture's REPORTED size with the sampled
 * region composed into it at `margin.position`.
 *
 * happy-dom has no 2D context, so the draw is asserted through a recording
 * stub — the exact `drawImage` arguments ARE the parity claim (which texels are
 * copied and where they land); the golden proves they reach the screen.
 */

import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rasterizeAtlasTexture } from './renderer';
import type { AtlasTextureLayout } from './types';

interface DrawCall {
  args: number[];
}

function stubCanvas(withContext = true) {
  const calls: DrawCall[] = [];
  const canvas = { width: 0, height: 0, getContext: () => (withContext ? ctx : null) };
  const ctx = {
    imageSmoothingEnabled: true,
    drawImage: (_image: unknown, ...args: number[]) => {
      calls.push({ args });
    },
  };
  const spy = vi
    .spyOn(globalThis.document, 'createElement')
    .mockReturnValue(canvas as unknown as HTMLElement);
  return { calls, canvas, ctx, spy };
}

afterEach(() => {
  vi.restoreAllMocks();
});

const IMAGE = { width: 128, height: 128 };

const layout = (over: Partial<AtlasTextureLayout> = {}): AtlasTextureLayout => ({
  width: 64,
  height: 64,
  source: { x: 32, y: 32, width: 64, height: 64 },
  dest: { x: 0, y: 0 },
  ...over,
});

describe('rasterizeAtlasTexture', () => {
  it('copies the region into a canvas of the reported size, unresampled and sRGB-tagged', () => {
    const { calls, canvas } = stubCanvas();

    const texture = rasterizeAtlasTexture(IMAGE, layout());

    expect(canvas.width).toBe(64);
    expect(canvas.height).toBe(64);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.args).toEqual([32, 32, 64, 64, 0, 0, 64, 64]);
    expect(texture).toBeInstanceOf(THREE.CanvasTexture);
    expect(texture!.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texture!.image).toBe(canvas);
  });

  it('places the region at margin.position inside a margined box', () => {
    const { calls, canvas } = stubCanvas();

    rasterizeAtlasTexture(IMAGE, {
      width: 48,
      height: 52,
      source: { x: 96, y: 0, width: 32, height: 32 },
      dest: { x: 8, y: 6 },
    });

    expect([canvas.width, canvas.height]).toEqual([48, 52]);
    expect(calls[0]!.args).toEqual([96, 0, 32, 32, 8, 6, 32, 32]);
  });

  it('clips a region running past the atlas edge, shifting the destination with it', () => {
    const { calls } = stubCanvas();

    rasterizeAtlasTexture(IMAGE, {
      width: 64,
      height: 64,
      source: { x: -16, y: 96, width: 64, height: 64 },
      dest: { x: 0, y: 0 },
    });

    // x: 16 columns are off the left edge, so the copy starts at 0 and lands 16
    // px in. y: 96 + 64 runs 32 rows past the bottom, so only 32 rows copy.
    expect(calls[0]!.args).toEqual([0, 96, 48, 32, 16, 0, 48, 32]);
  });

  it('declines a region entirely outside the atlas', () => {
    const { calls } = stubCanvas();

    expect(
      rasterizeAtlasTexture(IMAGE, {
        ...layout(),
        source: { x: 200, y: 0, width: 64, height: 64 },
      })
    ).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('declines an undecoded image and a context-less canvas', () => {
    const noContext = stubCanvas(false);
    expect(rasterizeAtlasTexture(IMAGE, layout())).toBeNull();
    noContext.spy.mockRestore();

    stubCanvas();
    expect(rasterizeAtlasTexture({ width: 0, height: 0 }, layout())).toBeNull();
    expect(rasterizeAtlasTexture(null, layout())).toBeNull();
  });
});
