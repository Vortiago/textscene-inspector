/** An OpenEXR image decoded to half-float RGBA, top row first, as Godot's `Image::load_exr` reads it. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ragdollBytes } from '../../testing/ragdollBake';
import { decodeExr, type HalfFloatPixels } from './exr';

/**
 * Written only by `ragdollAtlas`, on its first call, and never cleared: the tests only read it. One
 * decode per file, not per test, as each decode takes seconds once a full run fills the worker heap.
 */
let decodedAtlas: Promise<HalfFloatPixels> | null = null;

/** The vendored ragdoll lightmap atlas, decoded. */
function ragdollAtlas(): Promise<HalfFloatPixels> {
  decodedAtlas ??= decodeExr(ragdollBytes('ragdoll_physics.exr'));
  return decodedAtlas;
}

/** The pixel at `x`, `y` as the floats its half-float bits hold. */
function pixel({ data, width }: HalfFloatPixels, x: number, y: number): number[] {
  return [...data.subarray((y * width + x) * 4, (y * width + x + 1) * 4)].map(THREE.DataUtils.fromHalfFloat);
}

describe('decodeExr', () => {
  it("reads a lightmap atlas at Godot's size", async () => {
    const atlas = await ragdollAtlas();
    expect([atlas.width, atlas.height]).toEqual([2048, 2048]);
  });

  it('keeps the half-float values Godot reads, top row first', async () => {
    // Godot reads the atlas as FORMAT_RGBH, so each value is a half float, which the bits hold exactly.
    // Godot 4.6.3 `Image.load_from_file(...).get_pixel(100, 40)` on the vendored atlas.
    const atlas = await ragdollAtlas();
    expect(pixel(atlas, 100, 40)).toEqual([0.2568359375, 0.13037109375, 0.10784912109375, 1]);
  });

  it('fills alpha with 1 for an RGB image (edge case)', async () => {
    const atlas = await ragdollAtlas();
    expect(pixel(atlas, 0, 0)[3]).toBe(1);
  });

  it('refuses bytes that are no OpenEXR image (error case)', async () => {
    await expect(decodeExr(new Uint8Array([1, 2, 3, 4]).buffer)).rejects.toThrow();
  });
});
