/**
 * Byte identity for the NoiseTexture2D levels. Every path that claims these bytes (the worker
 * job, the in-thread fallback, the shipped worker bundle) is held to the same pinned hashes.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { noiseTexture2DLevels } from './pixels';
import { NOISE_PIXEL_CASES, PINNED_LEVEL_HASHES, PINNED_PIXEL_HASHES } from './pixelCases.testkit';

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('NoiseTexture2D levels', () => {
  const caseNames = NOISE_PIXEL_CASES.map((c) => c.name).sort();

  it('pins a hash for every case', () => {
    expect(Object.keys(PINNED_PIXEL_HASHES).sort()).toEqual(caseNames);
    expect(Object.keys(PINNED_LEVEL_HASHES).sort()).toEqual(caseNames);
  });

  it.each(NOISE_PIXEL_CASES)(
    "computes the levels Godot's generate_mipmaps builds, without THREE, for $name",
    ({ name, tex, noise, colorRamp }) => {
      const levels = noiseTexture2DLevels({ tex, noise, colorRamp });
      expect(levels.map((level) => sha256(level.data))).toEqual(PINNED_LEVEL_HASHES[name]);
    }
  );

  it.each(NOISE_PIXEL_CASES)(
    'computes the base level alone with generate_mipmaps off for $name',
    ({ name, tex, noise, colorRamp }) => {
      const levels = noiseTexture2DLevels({ tex: { ...tex, generateMipmaps: false }, noise, colorRamp });
      expect(levels.map((level) => sha256(level.data))).toEqual([PINNED_PIXEL_HASHES[name]]);
    }
  );
});
