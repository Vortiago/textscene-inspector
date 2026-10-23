/**
 * Byte identity for the NoiseTexture2D levels. Every path that claims these bytes (the worker
 * job, the in-thread fallback, the shipped worker bundle) is held to the same pinned hashes.
 */
import { describe, expect, it } from 'vitest';
import { noiseTexture2DLevels } from './pixels';
import {
  levelHashes,
  NOISE_PIXEL_CASES,
  PINNED_LEVEL_HASHES,
  PINNED_PIXEL_HASHES,
} from './pixelCases.testkit';

describe('NoiseTexture2D levels', () => {
  const caseNames = NOISE_PIXEL_CASES.map((c) => c.name).sort();

  it('pins the hashes of every case', () => {
    expect(Object.keys(PINNED_LEVEL_HASHES).sort()).toEqual(caseNames);
  });

  it.each(NOISE_PIXEL_CASES)(
    "computes the levels Godot's generate_mipmaps builds, without THREE, for $name",
    ({ name, tex, noise, colorRamp }) => {
      const levels = noiseTexture2DLevels({ tex, noise, colorRamp });
      expect(levelHashes(levels)).toEqual(PINNED_LEVEL_HASHES[name]);
    }
  );

  it('computes the base level alone with generate_mipmaps off', () => {
    const { name, tex, noise, colorRamp } = NOISE_PIXEL_CASES[0]!;
    const levels = noiseTexture2DLevels({ tex: { ...tex, generateMipmaps: false }, noise, colorRamp });
    expect(levelHashes(levels)).toEqual([PINNED_PIXEL_HASHES[name]]);
  });
});
