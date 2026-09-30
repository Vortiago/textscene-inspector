import { describe, expect, it } from 'vitest';
import {
  longTasksAfterFirstReply,
  longTasksDuringTextureWork,
  textureWorkWindow,
} from './textureWorkProbe.mjs';

describe('textureWorkWindow', () => {
  it('spans the first attach to the last detach of the status', () => {
    expect(textureWorkWindow({ statusAttached: [100, 900], statusDetached: [400, 1500] })).toEqual({
      start: 100,
      end: 1500,
    });
  });

  it('is null when the status never showed, so the gate cannot pass vacuously', () => {
    expect(textureWorkWindow({ statusAttached: [], statusDetached: [] })).toBeNull();
  });

  it('is null while the status is still attached', () => {
    expect(textureWorkWindow({ statusAttached: [100], statusDetached: [] })).toBeNull();
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
