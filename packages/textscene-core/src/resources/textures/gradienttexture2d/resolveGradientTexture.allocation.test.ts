/**
 * A GradientTexture2D the tab cannot allocate draws no texture instead of throwing out of the
 * render. The failure is forced in the rasteriser, since a real one needs a gigabyte.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import type { TscnInternalResource } from '../../../parser/types';
import { resolveGradientTexture2D } from './resolveGradientTexture';

/** What the mocked rasteriser throws, or null to run the real one. */
const failure = vi.hoisted(() => ({ error: null as Error | null }));

vi.mock('./build', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./build')>();
  return {
    ...actual,
    rasterizeGradientTexture2D: (...args: Parameters<typeof actual.rasterizeGradientTexture2D>) => {
      if (failure.error) throw failure.error;
      return actual.rasterizeGradientTexture2D(...args);
    },
  };
});

/** A fresh table per test: the procedural cache keys on the table, so each resolve rasterises. */
function resources(): TscnInternalResource[] {
  return [
    {
      id: 'Gradient_a',
      type: 'Gradient',
      data: { offsets: 'PackedFloat32Array(0, 1)', colors: 'PackedColorArray(0, 0, 0, 1, 1, 1, 1, 1)' },
    },
    {
      id: 'GradientTexture2D_a',
      type: 'GradientTexture2D',
      data: { gradient: 'SubResource("Gradient_a")', width: '8', height: '4' },
    },
  ];
}

const REF = 'SubResource("GradientTexture2D_a")';

afterEach(() => {
  failure.error = null;
  vi.restoreAllMocks();
});

describe('resolveGradientTexture2D allocation', () => {
  it('draws the texture when the pixels allocate', () => {
    expect(resolveGradientTexture2D(REF, resources())?.texture.image.width).toBe(8);
  });

  it('draws no texture, and says why, when an allocation fails', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    failure.error = new RangeError('Array buffer allocation failed');

    expect(resolveGradientTexture2D(REF, resources())).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[GradientTexture2D] 8x4 could not be allocated'));
  });

  it('lets any other failure through', () => {
    failure.error = new TypeError('not an allocation');

    expect(() => resolveGradientTexture2D(REF, resources())).toThrow(TypeError);
  });
});
