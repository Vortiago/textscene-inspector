/**
 * The physics ticks Godot 4.6.3 runs under the `ref:godot` harness's `--fixed-fps 1000`, as an
 * oracle scene logged them at the end of each process frame for each project clock.
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_PHYSICS_CLOCK, physicsTicksThrough, type PhysicsClock } from './physicsTicks';

/** The process frames in which a tick lands, for the first `count` ticks. */
function tickFrames(clock: PhysicsClock, count: number): number[] {
  const frames: number[] = [];
  for (let frame = 0; frames.length < count; frame++) {
    const landed =
      physicsTicksThrough(frame, HARNESS_FPS, clock) -
      (frame === 0 ? 0 : physicsTicksThrough(frame - 1, HARNESS_FPS, clock));
    for (let tick = 0; tick < landed; tick++) frames.push(frame);
  }
  return frames;
}

/** The harness's `--fixed-fps`, which every measurement here ran at. */
const HARNESS_FPS = 1000;

const clockAt = (ticksPerSecond: number, jitterFix = 0.5): PhysicsClock => ({ ticksPerSecond, jitterFix });

describe('physicsTicksThrough', () => {
  it('runs no tick before the first lands', () => {
    expect(physicsTicksThrough(7, HARNESS_FPS, DEFAULT_PHYSICS_CLOCK)).toBe(0);
  });

  it('lands the first ticks of the default clock where Godot does', () => {
    expect(tickFrames(DEFAULT_PHYSICS_CLOCK, 6)).toEqual([8, 33, 49, 66, 83, 99]);
  });

  it('lands the ticks of a faster clock where Godot does', () => {
    expect(tickFrames(clockAt(120), 4)).toEqual([4, 12, 20, 29]);
    expect(tickFrames(clockAt(240), 4)).toEqual([2, 6, 10, 14]);
  });

  it('lands the ticks of a slower clock where Godot does', () => {
    expect(tickFrames(clockAt(50), 4)).toEqual([10, 40, 59, 79]);
    expect(tickFrames(clockAt(30), 4)).toEqual([33, 66, 99, 133]);
  });

  it.each([
    [1, 0],
    [7, 6],
    [30, 27],
    [50, 46],
    [60, 55],
    [120, 110],
    [144, 133],
    [240, 221],
    [1000, 924],
  ])('counts the ticks Godot runs by frame 923 at %i ticks a second', (ticksPerSecond, ticks) => {
    expect(physicsTicksThrough(923, HARNESS_FPS, clockAt(ticksPerSecond))).toBe(ticks);
  });

  it('lets a wide jitter fix pull ticks early', () => {
    expect(tickFrames(clockAt(144, 2), 5)).toEqual([0, 1, 6, 13, 20]);
    expect(physicsTicksThrough(923, HARNESS_FPS, clockAt(144, 2))).toBe(134);
  });

  it('lets no jitter fix hold ticks to the clock', () => {
    expect(tickFrames(clockAt(144, 0), 5)).toEqual([6, 13, 20, 27, 34]);
    expect(physicsTicksThrough(923, HARNESS_FPS, clockAt(144, 0))).toBe(133);
  });
});
