import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { deviceSampleCount } from './deviceSampleCount';

const RGBA8 = 0x8058;
const RGBA16F = 0x881a;
const DEPTH_COMPONENT24 = 0x81a6;

/** A renderer whose WebGL2 context lists `counts` per renderbuffer format, lost while `lost.current`. */
function rendererWith(
  counts: Record<number, number[]>,
  queries: number[] = [],
  lost = { current: false }
): THREE.WebGLRenderer {
  const context = {
    RENDERBUFFER: 0x8d41,
    SAMPLES: 0x80a9,
    RGBA8,
    RGBA16F,
    DEPTH_COMPONENT24,
    isContextLost: () => lost.current,
    getInternalformatParameter: (_target: number, format: number) => {
      queries.push(format);
      return lost.current ? null : Int32Array.from(counts[format] ?? []);
    },
  };
  return { getContext: () => context } as unknown as THREE.WebGLRenderer;
}

describe('deviceSampleCount', () => {
  it('draws the requested count where colour and depth both support it', () => {
    const gl = rendererWith({ [RGBA8]: [8, 4, 2], [DEPTH_COMPONENT24]: [8, 4, 2] });
    expect(deviceSampleCount(gl, 4)).toBe(4);
  });

  it('falls to the closest lower count that colour and depth share', () => {
    const gl = rendererWith({ [RGBA8]: [8, 4, 2], [DEPTH_COMPONENT24]: [4, 2] });
    expect(deviceSampleCount(gl, 8)).toBe(4);
  });

  it('draws one sample for a context that cannot list its counts (error path)', () => {
    const gl = { getContext: () => ({}) } as unknown as THREE.WebGLRenderer;
    expect(deviceSampleCount(gl, 4)).toBe(0);
  });

  it('queries each context once, however many viewports ask', () => {
    const queries: number[] = [];
    const gl = rendererWith({ [RGBA8]: [4], [DEPTH_COMPONENT24]: [4] }, queries);
    deviceSampleCount(gl, 4);
    deviceSampleCount(gl, 8);
    expect(queries).toHaveLength(2);
  });

  it('takes the counts of the colour storage the target uses', () => {
    const gl = rendererWith({ [RGBA8]: [8, 4], [RGBA16F]: [4], [DEPTH_COMPONENT24]: [8, 4] });
    expect(deviceSampleCount(gl, 8, 'RGBA16F')).toBe(4);
  });

  it('queries a lost context again once the browser restores it (edge case)', () => {
    const lost = { current: true };
    const gl = rendererWith({ [RGBA8]: [4], [DEPTH_COMPONENT24]: [4] }, [], lost);
    expect(deviceSampleCount(gl, 4)).toBe(0);
    lost.current = false;
    expect(deviceSampleCount(gl, 4)).toBe(4);
  });
});
