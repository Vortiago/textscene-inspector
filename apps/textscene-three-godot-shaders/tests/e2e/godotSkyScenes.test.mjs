import { describe, expect, it } from 'vitest';
import { skyRuns } from './godotSkyScenes.mjs';

const scene = (name, clock) => ({ name, ...(clock ? { clock } : {}) });

describe('skyRuns', () => {
  it('runs the scenes of no clock together, with no options', () => {
    const runs = skyRuns([scene('a'), scene('b')]);
    expect(runs).toEqual([{ scenes: [scene('a'), scene('b')], options: { arguments: [], settings: '' } }]);
  });

  it('runs each clock apart, as Godot holds one step and one rollover per run', () => {
    const slow = { fixedFps: 3, rolloverSeconds: 1.2, frames: 4 };
    const fast = { fixedFps: 8, rolloverSeconds: 3600, frames: 4 };
    const runs = skyRuns([scene('a', slow), scene('b'), scene('c', fast), scene('d', slow)]);
    expect(runs.map((run) => run.scenes.map((each) => each.name))).toEqual([['b'], ['a', 'd'], ['c']]);
    expect(runs[1].options).toEqual({
      arguments: ['--fixed-fps', '3'],
      settings:
        '[rendering]\nlimits/time/time_rollover_secs=1.2\n\n[physics]\ncommon/physics_jitter_fix=0.0\n',
    });
  });
});
