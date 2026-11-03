import { describe, it, expect } from 'vitest';
import { HARNESS_FRAME, replayTransformFlushes, transformFlushesThrough } from './transformFlushes';

describe('transformFlushesThrough', () => {
  // A two-relay cycle pushes twice in the first flush and once in each flush after it, so these
  // are the pushes Godot 4.6.3 logged by the end of each frame under --fixed-fps 1000, less one.
  // Frame 8 holds the first physics tick.
  it('counts the flushes Godot runs by the end of each of the first ten frames', () => {
    const flushes = Array.from({ length: 10 }, (_, frame) => transformFlushesThrough(frame));
    expect(flushes).toEqual([3, 6, 9, 12, 15, 18, 21, 24, 29, 32]);
  });

  it('counts the 55 physics ticks Godot runs by the harness frame', () => {
    expect(transformFlushesThrough(HARNESS_FRAME)).toBe(2882);
  });

  it('adds the second physics tick in frame 33, not frame 32', () => {
    expect(transformFlushesThrough(33) - transformFlushesThrough(32)).toBe(5);
  });
});

describe('replayTransformFlushes', () => {
  it('walks the entries in reverse enter order first', () => {
    const notified: string[] = [];
    replayTransformFlushes(['a', 'b', 'c'], 1, (entry) => notified.push(entry));
    expect(notified).toEqual(['c', 'b', 'a']);
  });

  it('leaves an entry queued during a walk for the next walk, newest first', () => {
    const notified: string[] = [];
    replayTransformFlushes(['a'], 2, (entry, queue) => {
      notified.push(entry);
      if (entry === 'a') ['x', 'y'].forEach(queue);
    });
    expect(notified).toEqual(['a', 'y', 'x']);
  });

  it('keeps the place of an entry that is still on the list when it is queued again', () => {
    const notified: string[] = [];
    replayTransformFlushes(['a', 'b'], 1, (entry, queue) => {
      notified.push(entry);
      queue('a');
    });
    expect(notified).toEqual(['b', 'a']);
  });

  it('stops once the list is empty', () => {
    let notifications = 0;
    replayTransformFlushes(['a'], 1000, () => notifications++);
    expect(notifications).toBe(1);
  });
});
