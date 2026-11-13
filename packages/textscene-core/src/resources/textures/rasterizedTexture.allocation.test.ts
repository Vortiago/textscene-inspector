/**
 * A procedural texture the tab cannot allocate draws no texture instead of throwing out of the
 * render, whichever slice rasterises it: the guard sits in the shared rasteriser and build. The failure is
 * forced in each rasteriser, since a real one needs gigabytes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../logger';
import type * as THREE from 'three';
import { WorkerJobRunner } from '../../workers/WorkerJobRunner';
import { resetProceduralTextures } from './proceduralBuilds';
import { proceduralTexture2D } from './resolveProceduralTexture';
import { texture2DSourceAt } from './texture2d/texture2DSource.testkit';

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
vi.mock('../noise/image/noiseImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../noise/image/noiseImage')>();
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
  resetProceduralTextures();
});

const GRADIENT_SCENE = `[sub_resource type="Gradient" id="Gradient_a"]
offsets = PackedFloat32Array(0, 1)
colors = PackedColorArray(0, 0, 0, 1, 1, 1, 1, 1)

[sub_resource type="GradientTexture2D" id="GradientTexture2D_a"]
gradient = SubResource("Gradient_a")
width = 8
height = 4
`;

const NOISE_SCENE = `[sub_resource type="FastNoiseLite" id="FastNoiseLite_a"]
frequency = 0.05

[sub_resource type="NoiseTexture2D" id="NoiseTexture2D_a"]
noise = SubResource("FastNoiseLite_a")
width = 8
height = 8
`;

/**
 * The lookup of a freshly decoded texture: the gradient cache keys on the decoded value, so each
 * call rasterises. The noise cache keys on content, so `afterEach` clears it.
 */
function lookupOf(ref: string, sceneText: string) {
  return proceduralTexture2D(texture2DSourceAt(ref, sceneText));
}

describe('GradientTexture2D allocation', () => {
  function resolve(): THREE.Texture | null {
    const lookup = lookupOf('SubResource("GradientTexture2D_a")', GRADIENT_SCENE);
    return lookup?.status === 'ready' ? lookup.texture : null;
  }

  it('draws the texture when the pixels allocate', () => {
    expect((resolve()?.image as { width: number } | undefined)?.width).toBe(8);
  });

  it('draws no texture, and names the type, when an allocation fails', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    failure.error = new RangeError('Array buffer allocation failed');

    expect(resolve()).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      '[GradientTexture2D] could not be allocated (Array buffer allocation failed); drawing no texture'
    );
  });

  it('lets any other failure through', () => {
    failure.error = new TypeError('not an allocation');

    expect(() => resolve()).toThrow(TypeError);
  });
});

describe('NoiseTexture2D allocation', () => {
  /** The build's outcome, through the in-thread runner that runs the worker's job. */
  function build(): Promise<THREE.Texture | null> {
    const lookup = lookupOf('SubResource("NoiseTexture2D_a")', NOISE_SCENE);
    if (lookup?.status !== 'pending') throw new Error(`expected a pending build, got ${lookup?.status}`);
    return lookup.start(new WorkerJobRunner()).settled;
  }

  it('draws the texture when the pixels allocate', async () => {
    expect(((await build())?.image as { width: number } | undefined)?.width).toBe(8);
  });

  it('draws no texture, and names the type, when an allocation fails', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    failure.error = new RangeError('Array buffer allocation failed');

    expect(await build()).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      '[NoiseTexture2D] could not be allocated (Array buffer allocation failed); drawing no texture'
    );
  });

  it('lets any other failure through', async () => {
    failure.error = new TypeError('not an allocation');

    await expect(build()).rejects.toBeInstanceOf(TypeError);
  });
});
