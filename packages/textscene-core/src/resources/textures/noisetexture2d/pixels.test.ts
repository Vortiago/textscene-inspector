/**
 * Byte identity for the NoiseTexture2D pixels. Every path that claims these pixels
 * (the worker job, the in-thread fallback, the shipped worker bundle) is held to
 * the same pinned hashes.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
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

  it.each(NOISE_PIXEL_CASES)('computes the pinned bytes without THREE for $name', ({ name, tex, noise, colorRamp }) => {
    expect(sha256(noiseTexture2DPixels({ tex, noise, colorRamp }))).toBe(PINNED_PIXEL_HASHES[name]);
  });
});
