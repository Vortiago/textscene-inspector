import { describe, expect, it } from 'vitest';
import { checkWorkerArm } from './textureWorkScenarios.mjs';
import { fakeGate } from './gate.testkit.mjs';

const LARGE_TEXTURE = { inkOf: () => ({ inkPixels: 30000 }), inkFloor: 20000 };

/** A worker arm whose status came and went, with `probe` fields over that. */
function arm(probe) {
  return {
    probe: {
      statusAttached: [1000],
      statusDetached: [9000],
      replyTimes: [7000],
      replies: 1,
      longTasks: [],
      ...probe,
    },
    settled: { buffer: Buffer.from('frame') },
  };
}

describe('checkWorkerArm', () => {
  it('records nothing for an arm whose worker replied and left the main thread free', () => {
    const gate = fakeGate();
    checkWorkerArm(gate, 'long tasks', arm({}), LARGE_TEXTURE);
    expect(gate.failures).toEqual([]);
  });

  it('names each task over the limit after the reply (error case)', () => {
    const gate = fakeGate();
    checkWorkerArm(
      gate,
      'long tasks',
      arm({ longTasks: [{ startTime: 7100, duration: 80 }] }),
      LARGE_TEXTURE
    );
    expect(gate.failures).toEqual([
      '[long tasks] 1 task(s) over 50 ms while the texture built and uploaded: [{"startTime":7100,"duration":80}]',
    ]);
  });

  it('reports an arm with nothing measured once, not as a count of undefined tasks (edge case)', () => {
    const gate = fakeGate();
    checkWorkerArm(gate, 'long tasks', arm({ replyTimes: [], replies: 0 }), LARGE_TEXTURE);
    expect(gate.failures.join('\n')).not.toMatch(/undefined/);
    expect(gate.failures).toEqual([
      '[long tasks] the texture work status never came and went, or no worker replied: nothing was measured',
      '[long tasks] no job worker answered: the build did not run off the main thread',
    ]);
  });
});
