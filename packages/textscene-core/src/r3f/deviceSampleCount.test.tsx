import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import { useDeviceSampleCount, type ColourStorage } from './deviceSampleCount';

const RGBA8 = 0x8058;
const RGBA16F = 0x881a;
const DEPTH_COMPONENT24 = 0x81a6;

type FakeContext = object;

/** A WebGL2 context that lists `counts` per renderbuffer format, lost while `lost.current`. */
function contextWith(
  counts: Record<number, number[]>,
  queries: number[] = [],
  lost = { current: false }
): FakeContext {
  return {
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
}

/** Hands the canvas's renderer `context` before its children render. */
function OnContext({ context, children }: { context: FakeContext; children: ReactNode }) {
  const gl = useThree((state) => state.gl);
  gl.getContext = () => context as WebGL2RenderingContext;
  return children;
}

/** The samples `useDeviceSampleCount` gives for `requested` on a canvas over `context`. */
async function sampleCount(context: FakeContext, requested: number, storage?: ColourStorage) {
  let seen: number | null = null;
  function Probe() {
    seen = useDeviceSampleCount(requested, storage);
    return null;
  }
  await ReactThreeTestRenderer.create(
    <OnContext context={context}>
      <Probe />
    </OnContext>
  );
  return seen;
}

describe('useDeviceSampleCount', () => {
  it('draws the requested count where colour and depth both support it', async () => {
    const context = contextWith({ [RGBA8]: [8, 4, 2], [DEPTH_COMPONENT24]: [8, 4, 2] });
    expect(await sampleCount(context, 4)).toBe(4);
  });

  it('falls to the closest lower count that colour and depth share', async () => {
    const context = contextWith({ [RGBA8]: [8, 4, 2], [DEPTH_COMPONENT24]: [4, 2] });
    expect(await sampleCount(context, 8)).toBe(4);
  });

  it('draws one sample for a context that cannot list its counts (error path)', async () => {
    expect(await sampleCount({}, 4)).toBe(0);
  });

  it('queries each context once, however many viewports ask', async () => {
    const queries: number[] = [];
    const context = contextWith({ [RGBA8]: [4], [DEPTH_COMPONENT24]: [4] }, queries);
    await sampleCount(context, 4);
    await sampleCount(context, 8);
    expect(queries).toHaveLength(2);
  });

  it('takes the counts of the colour storage the target uses', async () => {
    const context = contextWith({ [RGBA8]: [8, 4], [RGBA16F]: [4], [DEPTH_COMPONENT24]: [8, 4] });
    expect(await sampleCount(context, 8, 'RGBA16F')).toBe(4);
  });

  it('queries a lost context again once the browser restores it (edge case)', async () => {
    const lost = { current: true };
    const context = contextWith({ [RGBA8]: [4], [DEPTH_COMPONENT24]: [4] }, [], lost);
    expect(await sampleCount(context, 4)).toBe(0);
    lost.current = false;
    expect(await sampleCount(context, 4)).toBe(4);
  });
});
