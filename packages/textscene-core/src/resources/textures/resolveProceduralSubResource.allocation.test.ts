/**
 * A procedural texture the tab cannot allocate draws no texture instead of throwing out of the
 * render, whichever slice rasterises it: the guard sits in the shared resolver. The failure is
 * forced in each rasteriser, since a real one needs gigabytes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../logger';
import type { TscnInternalResource } from '../../parser/types';
import { resolveGradientTexture2D } from './gradienttexture2d/resolveGradientTexture';
import { resolveNoiseTexture2D } from './noisetexture2d/resolveNoiseTexture';

/** What each mocked rasteriser throws, or null to run the real one. */
const failure = vi.hoisted(() => ({ error: null as Error | null }));

vi.mock('./gradienttexture2d/build', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./gradienttexture2d/build')>();
  return {
    ...actual,
    rasterizeGradientTexture2D: (...args: Parameters<typeof actual.rasterizeGradientTexture2D>) => {
      if (failure.error) throw failure.error;
      return actual.rasterizeGradientTexture2D(...args);
    },
  };
});

// `noiseImage` is the NoiseTexture2D pipeline's first typed array.
vi.mock('./noisetexture2d/noiseImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./noisetexture2d/noiseImage')>();
  return {
    ...actual,
    noiseImage: (...args: Parameters<typeof actual.noiseImage>) => {
      if (failure.error) throw failure.error;
      return actual.noiseImage(...args);
    },
  };
});

afterEach(() => {
  failure.error = null;
  vi.restoreAllMocks();
});

/** A fresh table per call: the procedural cache keys on the table, so each resolve rasterises. */
function gradientResources(): TscnInternalResource[] {
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

function noiseResources(): TscnInternalResource[] {
  return [
    { id: 'FastNoiseLite_a', type: 'FastNoiseLite', data: { frequency: '0.05' } },
    {
      id: 'NoiseTexture2D_a',
      type: 'NoiseTexture2D',
      data: { noise: 'SubResource("FastNoiseLite_a")', width: '8', height: '8' },
    },
  ];
}

const CASES = [
  {
    typeName: 'GradientTexture2D',
    resolve: () => resolveGradientTexture2D('SubResource("GradientTexture2D_a")', gradientResources()),
    id: 'GradientTexture2D_a',
  },
  {
    typeName: 'NoiseTexture2D',
    resolve: () => resolveNoiseTexture2D('SubResource("NoiseTexture2D_a")', noiseResources()),
    id: 'NoiseTexture2D_a',
  },
] as const;

describe.each(CASES)('$typeName allocation', ({ typeName, resolve, id }) => {
  it('draws the texture when the pixels allocate', () => {
    expect(resolve()?.texture.image.width).toBe(8);
  });

  it('draws no texture, and names the type and the sub-resource, when an allocation fails', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    failure.error = new RangeError('Array buffer allocation failed');

    expect(resolve()).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      `[${typeName}] sub-resource "${id}" could not be allocated (Array buffer allocation failed); drawing no texture`
    );
  });

  it('lets any other failure through', () => {
    failure.error = new TypeError('not an allocation');

    expect(() => resolve()).toThrow(TypeError);
  });
});
