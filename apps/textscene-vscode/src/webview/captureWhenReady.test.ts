import { describe, expect, it, vi } from 'vitest';
import { captureWhenReady } from './captureWhenReady';

/** A clock the test advances by hand, so no timer actually runs. */
function makeClock(): { now: () => number; advance: (ms: number) => void } {
  let t = 0;
  return {
    now: () => t,
    advance: (ms) => {
      t += ms;
    },
  };
}

describe('captureWhenReady', () => {
  it('posts the image from the first attempt', () => {
    const clock = makeClock();
    const post = vi.fn();
    const fail = vi.fn();

    captureWhenReady({
      capture: () => 'data:image/png;base64,AA==',
      post,
      fail,
      now: clock.now,
      schedule: vi.fn(),
      deadlineMs: 100,
    });

    expect(post).toHaveBeenCalledWith('data:image/png;base64,AA==');
    expect(fail).not.toHaveBeenCalled();
  });

  it('retries until the canvas registers its handler', () => {
    const clock = makeClock();
    const scheduled: Array<() => void> = [];
    const post = vi.fn();
    const fail = vi.fn();
    let ready = false;

    captureWhenReady({
      capture: () => (ready ? 'data:image/png;base64,AA==' : null),
      post,
      fail,
      now: clock.now,
      schedule: (run) => scheduled.push(run),
      deadlineMs: 100,
    });

    // The canvas mounts a beat later, so the first attempt schedules a retry.
    expect(post).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);

    ready = true;
    clock.advance(10);
    scheduled.shift()!();

    expect(post).toHaveBeenCalledWith('data:image/png;base64,AA==');
    expect(fail).not.toHaveBeenCalled();
  });

  it('fails once the deadline passes with no handler', () => {
    const clock = makeClock();
    const scheduled: Array<() => void> = [];
    const post = vi.fn();
    const fail = vi.fn();

    captureWhenReady({
      capture: () => null,
      post,
      fail,
      now: clock.now,
      schedule: (run) => scheduled.push(run),
      deadlineMs: 100,
    });

    for (let i = 0; i < 20 && scheduled.length > 0; i++) {
      clock.advance(10);
      scheduled.shift()!();
    }

    expect(fail).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
  });
});
