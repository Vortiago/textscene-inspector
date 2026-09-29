/**
 * Byte identity for the NoiseTexture2D pixels. The hashes were taken from the
 * synchronous build before it moved off the main thread, so any path that claims
 * the same pixels (the worker job, the shipped worker bundle) is held to them.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { rasterizeNoiseTexture2D } from './build';
import { noiseTexture2DPixels } from './pixels';
import { NOISE_PIXEL_CASES, PINNED_PIXEL_HASHES } from './pixelCases.testkit';

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('NoiseTexture2D pixels', () => {
  it('pins a hash for every case', () => {
    expect(Object.keys(PINNED_PIXEL_HASHES).sort()).toEqual(
      NOISE_PIXEL_CASES.map((c) => c.name).sort()
    );
  });

  it.each(NOISE_PIXEL_CASES)('gives the pinned bytes for $name', ({ name, tex, noise, colorRamp }) => {
    const texture = rasterizeNoiseTexture2D(tex, noise, colorRamp);
    expect(sha256(texture?.image.data as Uint8Array)).toBe(PINNED_PIXEL_HASHES[name]);
  });

  it.each(NOISE_PIXEL_CASES)('computes the pinned bytes without THREE for $name', ({ name, tex, noise, colorRamp }) => {
    expect(sha256(noiseTexture2DPixels({ tex, noise, colorRamp }))).toBe(PINNED_PIXEL_HASHES[name]);
  });
});
