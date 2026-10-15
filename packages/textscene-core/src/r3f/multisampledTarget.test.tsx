import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useMultisampledTarget, useSampleCount, type TargetTexture } from './multisampledTarget';
import { takeOutputLikeDrawingBuffer } from './outputTarget';

const RGBA8 = 0x8058;
const SRGB8_ALPHA8 = 0x8c43;
const RGBA16F = 0x881a;
const DEPTH_COMPONENT24 = 0x81a6;

/** `Viewport.MSAA` modes (`scene/main/viewport.h`). */
const MSAA_DISABLED = 0;
const MSAA_4X = 2;
const MSAA_8X = 3;

/** A WebGL 2 context that lists `counts` per renderbuffer format, lost while `lost.current`. */
function contextWith(
  counts: Record<number, number[]>,
  queries: number[] = [],
  lost = { current: false }
): object {
  return {
    RENDERBUFFER: 0x8d41,
    SAMPLES: 0x80a9,
    RGBA8,
    SRGB8_ALPHA8,
    RGBA16F,
    DEPTH_COMPONENT24,
    isContextLost: () => lost.current,
    getInternalformatParameter: (_target: number, format: number) => {
      queries.push(format);
      return lost.current ? null : Int32Array.from(counts[format] ?? []);
    },
  };
}

/** A device whose 8-bit linear storage lists 8, its sRGB storage only 4, and its half float only 2. */
const SPLIT_DEVICE = {
  [RGBA8]: [8, 4, 2],
  [SRGB8_ALPHA8]: [4, 2],
  [RGBA16F]: [2],
  [DEPTH_COMPONENT24]: [8, 4, 2],
};

/** Mounts `read` as a hook on a canvas over `context`, and returns what it gave. */
async function onCanvas<T>(context: object, read: () => T): Promise<T> {
  let seen: T | undefined;
  function Probe() {
    seen = read();
    return null;
  }
  await ReactThreeTestRenderer.create(<Probe />, {
    gl: (defaults) => {
      const gl = new THREE.WebGLRenderer(defaults);
      gl.getContext = () => context as WebGL2RenderingContext;
      return gl;
    },
  });
  return seen as T;
}

const linearTarget = () => new THREE.WebGLRenderTarget(4, 4, { depthBuffer: true, stencilBuffer: false });

function srgbTarget(): THREE.WebGLRenderTarget {
  const target = linearTarget();
  target.texture.colorSpace = THREE.SRGBColorSpace;
  return target;
}

async function targetSamples(context: object, mode: number, create: () => THREE.WebGLRenderTarget) {
  return (await onCanvas(context, () => useMultisampledTarget(mode, create))).samples;
}

describe('useMultisampledTarget', () => {
  it('multisamples an 8-bit linear target at the count RGBA8 and depth share', async () => {
    expect(await targetSamples(contextWith(SPLIT_DEVICE), MSAA_8X, linearTarget)).toBe(8);
  });

  it('gives an sRGB-tagged target with no pinned format the count SRGB8_ALPHA8 lists', async () => {
    expect(await targetSamples(contextWith(SPLIT_DEVICE), MSAA_8X, srgbTarget)).toBe(4);
  });

  it('follows a pinned internal format over the colour space tag', async () => {
    const pinned = () => {
      const target = srgbTarget();
      target.texture.internalFormat = 'RGBA8';
      return target;
    };
    expect(await targetSamples(contextWith(SPLIT_DEVICE), MSAA_8X, pinned)).toBe(8);
  });

  it('stores an sRGB tag linear in a target that takes output like the drawing buffer', async () => {
    const likeDrawingBuffer = () => {
      const target = srgbTarget();
      takeOutputLikeDrawingBuffer(target);
      return target;
    };
    expect(await targetSamples(contextWith(SPLIT_DEVICE), MSAA_8X, likeDrawingBuffer)).toBe(8);
  });

  it('falls to the closest lower count that colour and depth share', async () => {
    const context = contextWith({ [RGBA8]: [8, 4, 2], [DEPTH_COMPONENT24]: [4, 2] });
    expect(await targetSamples(context, MSAA_8X, linearTarget)).toBe(4);
  });

  it('draws one sample per pixel at MSAA_DISABLED', async () => {
    expect(await targetSamples(contextWith(SPLIT_DEVICE), MSAA_DISABLED, linearTarget)).toBe(0);
  });

  it('draws one sample per pixel on a device without multisampled targets (error path)', async () => {
    expect(await targetSamples({}, MSAA_4X, linearTarget)).toBe(0);
  });

  it('queries a lost context again once the browser restores it (edge case)', async () => {
    const lost = { current: true };
    const context = contextWith(SPLIT_DEVICE, [], lost);
    expect(await targetSamples(context, MSAA_4X, linearTarget)).toBe(0);
    lost.current = false;
    expect(await targetSamples(context, MSAA_4X, linearTarget)).toBe(4);
  });

  it('queries each storage of a context once, however many targets ask', async () => {
    const queries: number[] = [];
    const context = contextWith(SPLIT_DEVICE, queries);
    await targetSamples(context, MSAA_4X, linearTarget);
    await targetSamples(context, MSAA_8X, linearTarget);
    expect(queries).toEqual([DEPTH_COMPONENT24, RGBA8]);
  });
});

describe('useSampleCount', () => {
  const halfFloat: TargetTexture = {
    type: THREE.HalfFloatType,
    colorSpace: THREE.NoColorSpace,
    internalFormat: null,
  };

  it('takes the counts RGBA16F lists for a half-float buffer', async () => {
    expect(await onCanvas(contextWith(SPLIT_DEVICE), () => useSampleCount(MSAA_8X, halfFloat))).toBe(2);
  });

  it('draws one sample per pixel on a device without multisampled targets (error path)', async () => {
    expect(await onCanvas({}, () => useSampleCount(MSAA_8X, halfFloat))).toBe(0);
  });
});
