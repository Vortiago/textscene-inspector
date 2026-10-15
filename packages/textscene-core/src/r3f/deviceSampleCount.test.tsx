import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useDeviceSampleCount, type ColourStorage } from './deviceSampleCount';
import { fakeWebGL2Context, rendererOver, type RenderbufferFormat } from './testing/fakeWebGL2Context';

/** The samples `useDeviceSampleCount` gives for `requested` on a canvas over `context`. */
async function sampleCount(context: object, requested: number, storage?: ColourStorage) {
  let seen: number | null = null;
  function Probe() {
    seen = useDeviceSampleCount(requested, storage);
    return null;
  }
  await ReactThreeTestRenderer.create(<Probe />, { gl: rendererOver(context) });
  return seen;
}

describe('useDeviceSampleCount', () => {
  it('draws the requested count where colour and depth both support it', async () => {
    const context = fakeWebGL2Context({ RGBA8: [8, 4, 2], DEPTH_COMPONENT24: [8, 4, 2] });
    expect(await sampleCount(context, 4)).toBe(4);
  });

  it('falls to the closest lower count that colour and depth share', async () => {
    const context = fakeWebGL2Context({ RGBA8: [8, 4, 2], DEPTH_COMPONENT24: [4, 2] });
    expect(await sampleCount(context, 8)).toBe(4);
  });

  it('draws one sample for a context that cannot list its counts (error path)', async () => {
    expect(await sampleCount({}, 4)).toBe(0);
  });

  it('queries each context once, however many viewports ask', async () => {
    const queries: RenderbufferFormat[] = [];
    const context = fakeWebGL2Context({ RGBA8: [4], DEPTH_COMPONENT24: [4] }, { queries });
    await sampleCount(context, 4);
    await sampleCount(context, 8);
    expect(queries).toHaveLength(2);
  });

  it('takes the counts of the colour storage the target uses', async () => {
    const context = fakeWebGL2Context({ RGBA8: [8, 4], RGBA16F: [4], DEPTH_COMPONENT24: [8, 4] });
    expect(await sampleCount(context, 8, 'RGBA16F')).toBe(4);
  });

  it('takes the counts of an sRGB 8-bit target from SRGB8_ALPHA8, not RGBA8', async () => {
    const context = fakeWebGL2Context({ RGBA8: [8, 4], SRGB8_ALPHA8: [4], DEPTH_COMPONENT24: [8, 4] });
    expect(await sampleCount(context, 8, 'SRGB8_ALPHA8')).toBe(4);
  });

  it('queries a lost context again once the browser restores it (edge case)', async () => {
    const lost = { current: true };
    const context = fakeWebGL2Context({ RGBA8: [4], DEPTH_COMPONENT24: [4] }, { lost });
    expect(await sampleCount(context, 4)).toBe(0);
    lost.current = false;
    expect(await sampleCount(context, 4)).toBe(4);
  });
});
