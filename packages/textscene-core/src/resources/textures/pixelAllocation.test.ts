/** The shared allocation guard: a `RangeError` draws no texture, and says why. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../logger';
import { unlessAllocationFails } from './pixelAllocation';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('unlessAllocationFails', () => {
  it('returns what the build returns when it allocates', () => {
    const pixels = new Uint8Array(4);
    expect(unlessAllocationFails('[Texture] 1x1', () => pixels)).toBe(pixels);
  });

  it('answers null, and names the texture, when an allocation fails', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const result = unlessAllocationFails('[Texture] 16384x16384', () => {
      throw new RangeError('Array buffer allocation failed');
    });

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      '[Texture] 16384x16384 could not be allocated (Array buffer allocation failed); drawing no texture'
    );
  });

  it('lets any other failure through', () => {
    expect(() =>
      unlessAllocationFails('[Texture] 1x1', () => {
        throw new TypeError('not an allocation');
      })
    ).toThrow(TypeError);
  });
});
