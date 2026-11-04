/**
 * The pacing between the tiled upload and the GPU: at most a window of bands is on
 * its way to the GPU at once, and a frame's bands leave the window once the GPU has
 * written them.
 */
import { describe, expect, it } from 'vitest';
import { manualClock } from '../frameProfile/frameProfile.testkit';
import { GpuPacer, type GpuFence } from './gpuPacer';

/** The bands the pacer lets be on their way to the GPU at once. */
const IN_FLIGHT_BANDS = 3;

/** A fence per call, each done only when the test says so, and each counting its disposals. */
function fakeFences() {
  const fences: { isDone: boolean; disposals: number }[] = [];
  const fence = (): GpuFence => {
    const state = { isDone: false, disposals: 0 };
    fences.push(state);
    return {
      isDone: () => state.isDone,
      dispose: () => {
        state.disposals++;
      },
    };
  };
  return { fence, fences };
}

describe('GpuPacer', () => {
  it('allows the whole window before anything is on its way', () => {
    const pacer = new GpuPacer(fakeFences().fence);

    expect(pacer.allowance()).toBe(IN_FLIGHT_BANDS);
  });

  it("counts every frame's bands still on their way against the window", () => {
    const pacer = new GpuPacer(fakeFences().fence);
    pacer.markIssued(1);
    pacer.markIssued(2);

    expect(pacer.allowance()).toBe(IN_FLIGHT_BANDS - 3);
  });

  it("frees a frame's bands once the GPU has passed its fence", () => {
    const { fence, fences } = fakeFences();
    const pacer = new GpuPacer(fence);
    pacer.markIssued(1);
    pacer.markIssued(2);
    fences[0]!.isDone = true;

    expect(pacer.allowance()).toBe(IN_FLIGHT_BANDS - 2);
  });

  it('frees every earlier frame with a later one, since the GPU runs commands in order', () => {
    const { fence, fences } = fakeFences();
    const pacer = new GpuPacer(fence);
    pacer.markIssued(1);
    pacer.markIssued(2);
    fences[1]!.isDone = true;

    expect(pacer.allowance()).toBe(IN_FLIGHT_BANDS);
  });

  it('allows nothing while the window is full, however far past it', () => {
    const pacer = new GpuPacer(fakeFences().fence);
    pacer.markIssued(IN_FLIGHT_BANDS + 1);

    expect(pacer.allowance()).toBe(0);
  });

  it('releases every earlier fence with the one the GPU passed', () => {
    const { fence, fences } = fakeFences();
    const pacer = new GpuPacer(fence);
    pacer.markIssued(1);
    pacer.markIssued(1);
    pacer.markIssued(1);
    fences[1]!.isDone = true;
    pacer.allowance();

    expect(fences.map(({ disposals }) => disposals)).toEqual([1, 1, 0]);
  });

  it('releases the fences still on their way when it is disposed', () => {
    const { fence, fences } = fakeFences();
    const pacer = new GpuPacer(fence);
    pacer.markIssued(1);
    pacer.markIssued(2);
    pacer.dispose();

    expect(fences.map(({ disposals }) => disposals)).toEqual([1, 1]);
    expect(pacer.allowance()).toBe(IN_FLIGHT_BANDS);
  });

  describe('when the GPU is slow to pass a fence', () => {
    const STALL_MS = 500;

    function fullWindow() {
      const clock = manualClock();
      const pacer = new GpuPacer(fakeFences().fence, clock.now);
      pacer.markIssued(IN_FLIGHT_BANDS);
      return { clock, pacer };
    }

    it('allows nothing before the stall time has passed', () => {
      const { clock, pacer } = fullWindow();
      clock.advance(STALL_MS - 1);

      expect(pacer.allowance()).toBe(0);
    });

    it('gives up on the oldest frame once the window has stood still for the stall time', () => {
      const { clock, pacer } = fullWindow();
      clock.advance(STALL_MS);

      expect(pacer.allowance()).toBe(IN_FLIGHT_BANDS);
    });

    it('waits for the stall time again before giving up on the next frame', () => {
      const { clock, pacer } = fullWindow();
      clock.advance(STALL_MS);
      pacer.markIssued(pacer.allowance());
      clock.advance(STALL_MS - 1);

      expect(pacer.allowance()).toBe(0);
      clock.advance(1);
      expect(pacer.allowance()).toBe(IN_FLIGHT_BANDS);
    });

    it('frees the fence it gave up on', () => {
      const { fence, fences } = fakeFences();
      const clock = manualClock();
      const pacer = new GpuPacer(fence, clock.now);
      pacer.markIssued(IN_FLIGHT_BANDS);
      clock.advance(STALL_MS);
      pacer.allowance();

      expect(fences[0]!.disposals).toBe(1);
    });
  });
});
