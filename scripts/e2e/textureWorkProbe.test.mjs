import { describe, expect, it } from 'vitest';
import {
  longTasksAfterFirstReply,
  longTasksDuringTextureWork,
  runAgainIfStalled,
} from './textureWorkProbe.mjs';

describe('the texture work window', () => {
  /** A task over the 50 ms limit starting at `startTime`. */
  const longTask = (startTime) => ({ startTime, duration: 60 });

  it('spans the first attach to the last detach of the status', () => {
    const probe = {
      statusAttached: [100, 900],
      statusDetached: [400, 1500],
      longTasks: [longTask(99), longTask(100), longTask(1499), longTask(1500)],
    };
    expect(longTasksDuringTextureWork(probe, 50)).toEqual([longTask(100), longTask(1499)]);
  });

  it('is absent when the status never showed, so the gate cannot pass vacuously', () => {
    const probe = { statusAttached: [], statusDetached: [], longTasks: [longTask(100)] };
    expect(longTasksDuringTextureWork(probe, 50)).toBeNull();
  });

  it('is absent while the status is still attached', () => {
    const probe = { statusAttached: [100], statusDetached: [], longTasks: [longTask(200)] };
    expect(longTasksDuringTextureWork(probe, 50)).toBeNull();
  });
});

describe('longTasksDuringTextureWork', () => {
  const probe = {
    statusAttached: [1000],
    statusDetached: [5000],
    longTasks: [
      { startTime: 500, duration: 300 },
      { startTime: 2000, duration: 51 },
      { startTime: 3000, duration: 50 },
      { startTime: 4990, duration: 80 },
      { startTime: 6000, duration: 200 },
    ],
  };

  it('keeps each task over the limit that starts inside the window', () => {
    expect(longTasksDuringTextureWork(probe, 50)).toEqual([
      { startTime: 2000, duration: 51 },
      { startTime: 4990, duration: 80 },
    ]);
  });

  it('leaves out the task that attached the status: it mounted the scene and only queued the work', () => {
    const mounting = { ...probe, longTasks: [{ startTime: 850, duration: 160 }] };
    expect(longTasksDuringTextureWork(mounting, 50)).toEqual([]);
  });

  it('is null when there is no window to measure', () => {
    expect(longTasksDuringTextureWork({ ...probe, statusAttached: [] }, 50)).toBeNull();
  });
});

describe('longTasksAfterFirstReply', () => {
  const probe = {
    statusAttached: [1000],
    statusDetached: [9000],
    replyTimes: [7000, 7500],
    longTasks: [
      { startTime: 1010, duration: 120 },
      { startTime: 6990, duration: 60 },
      { startTime: 8000, duration: 51 },
      { startTime: 8500, duration: 50 },
      { startTime: 9500, duration: 200 },
    ],
  };

  it('keeps each task over the limit that runs from the first reply until the status clears', () => {
    expect(longTasksAfterFirstReply(probe, 50)).toEqual([
      { startTime: 6990, duration: 60 },
      { startTime: 8000, duration: 51 },
    ]);
  });

  it('keeps the task that received the reply, which starts just before the reply is seen', () => {
    const receiving = { ...probe, longTasks: [{ startTime: 6999.5, duration: 90 }] };
    expect(longTasksAfterFirstReply(receiving, 50)).toEqual([{ startTime: 6999.5, duration: 90 }]);
  });

  it('leaves out the material arriving before the reply, as its first program link does', () => {
    const arriving = { ...probe, longTasks: [{ startTime: 1001, duration: 78 }] };
    expect(longTasksAfterFirstReply(arriving, 50)).toEqual([]);
  });

  it('is null when no worker replied, so the gate cannot pass vacuously', () => {
    expect(longTasksAfterFirstReply({ ...probe, replyTimes: [] }, 50)).toBeNull();
  });

  it('is null when there is no window to measure', () => {
    expect(longTasksAfterFirstReply({ ...probe, statusDetached: [] }, 50)).toBeNull();
  });
});

describe('runAgainIfStalled', () => {
  const runs = (...results) => {
    const queue = [...results];
    return Object.assign(async () => queue.shift(), { remaining: () => queue.length });
  };
  const isStalled = (result) => result.stalled;

  it('returns the first run when it saw no stall, and runs nothing more', async () => {
    const run = runs({ stalled: false, id: 'first' }, { stalled: true, id: 'second' });
    expect(await runAgainIfStalled(run, isStalled)).toEqual({ stalled: false, id: 'first' });
    expect(run.remaining()).toBe(1);
  });

  it('returns the second run when the first stalled, so a stall on runner load clears', async () => {
    const run = runs({ stalled: true, id: 'first' }, { stalled: false, id: 'second' });
    expect(await runAgainIfStalled(run, isStalled)).toEqual({ stalled: false, id: 'second' });
  });

  it('returns the second run when both stalled, so the same stall twice fails the gate', async () => {
    const run = runs({ stalled: true, id: 'first' }, { stalled: true, id: 'second' });
    expect(await runAgainIfStalled(run, isStalled)).toEqual({ stalled: true, id: 'second' });
    expect(run.remaining()).toBe(0);
  });
});
