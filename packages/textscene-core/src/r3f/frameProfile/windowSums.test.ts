import { describe, expect, it } from 'vitest';
import { add, NS_PER_MS, statsOf, WindowSums } from './windowSums.js';

/** Sums of `frames` frames of 16 ms each, 4 ms of CPU and 2 draw calls each. */
function steadySums(frames: number): WindowSums {
  const sums = new WindowSums();
  sums.frames = frames;
  sums.intervals = frames;
  sums.intervalMs = 16 * frames;
  sums.cpuMs = 4 * frames;
  sums.drawCalls = 2 * frames;
  return sums;
}

describe('WindowSums.gpuMsPerFrame', () => {
  it('spreads a GPU time over the frames whose results arrived', () => {
    const sums = new WindowSums();
    sums.gpuFrames = 4;

    expect(sums.gpuMsPerFrame(8 * NS_PER_MS)).toBe(2);
  });

  it('is null while no GPU result has arrived (edge case)', () => {
    expect(new WindowSums().gpuMsPerFrame(8 * NS_PER_MS)).toBeNull();
  });
});

describe('statsOf', () => {
  it('gives the per-frame means of the sums', () => {
    expect(statsOf(steadySums(10), null)).toMatchObject({ frameMs: 16, cpuMs: 4, drawCallsPerFrame: 2 });
  });

  it('leaves out the timings when they did not run (edge case)', () => {
    expect(statsOf(steadySums(10), null)).not.toHaveProperty('timings');
  });

  it('keeps the Other row with no GPU time when no result arrived (error case)', () => {
    const { timings } = statsOf(steadySums(10), { hasGpuTimer: true });

    expect(timings).toEqual({
      gpuMs: null,
      hasGpuTimer: true,
      steps: [{ step: 'Other', cpuMs: 0, gpuMs: null, runsPerFrame: 1, drawCallsPerFrame: 0 }],
    });
  });
});

describe('add', () => {
  it('adds to the sum at a key', () => {
    const sums = new Map([['Shadows', 2]]);
    add(sums, 'Shadows', 3);

    expect(sums.get('Shadows')).toBe(5);
  });

  it('starts a key with no sum at zero (edge case)', () => {
    const sums = new Map<string, number>();
    add(sums, 'Shadows', 3);

    expect(sums.get('Shadows')).toBe(3);
  });
});
