/**
 * A NoiseTexture2D the tab cannot allocate draws no texture instead of throwing. The failure is
 * forced in `noiseImage`, the pipeline's first typed array, since a real one needs gigabytes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { rasterizeNoiseTexture2D } from './build';
import { decodeNoiseTexture2D } from './decode';
import { decodeFastNoiseLite } from '../../noise/fastnoiselite/decode';

/** What the mocked `noiseImage` throws, or null to run the real one. */
const failure = vi.hoisted(() => ({ error: null as Error | null }));

vi.mock('./noiseImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./noiseImage')>();
  return {
    ...actual,
    noiseImage: (...args: Parameters<typeof actual.noiseImage>) => {
      if (failure.error) throw failure.error;
      return actual.noiseImage(...args);
    },
  };
});

const tex = decodeNoiseTexture2D({ width: '8', height: '8' });
const noise = decodeFastNoiseLite({ frequency: '0.05' });

afterEach(() => {
  failure.error = null;
  vi.restoreAllMocks();
});

describe('rasterizeNoiseTexture2D allocation', () => {
  it('draws the texture when the pixels allocate', () => {
    expect(rasterizeNoiseTexture2D(tex, noise, null)).not.toBeNull();
  });

  it('draws no texture, and says why, when an allocation fails', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    failure.error = new RangeError('Array buffer allocation failed');

    expect(rasterizeNoiseTexture2D(tex, noise, null)).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('8x8 could not be allocated'));
  });

  it('lets any other failure through', () => {
    failure.error = new TypeError('not an allocation');

    expect(() => rasterizeNoiseTexture2D(tex, noise, null)).toThrow(TypeError);
  });
});
