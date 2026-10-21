import { describe, expect, it } from 'vitest';
import { checkSettleControl, checkWorkerArm } from './textureWorkScenarios.mjs';
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

/** A settle control whose three captures settled, with `delayed` fields over the held arm. */
function settleControl(delayed) {
  const frame = Buffer.from('frame');
  return {
    baseline: { buffer: frame, settledMs: 1700 },
    delayed: { buffer: frame, settledMs: 6100, workers: 1, isHeldBuildReleased: true, ...delayed },
    unwaited: { buffer: Buffer.from('placeholder'), settledMs: 1700 },
  };
}

describe('checkSettleControl', () => {
  it('passes a delayed capture that settled after the held build was released', () => {
    const gate = fakeGate();
    // The hold starts while the page opens, before the settle clock, so 5954 ms is a real wait.
    checkSettleControl(gate, settleControl({ settledMs: 5954 }));
    expect(gate.failures).toEqual([]);
  });

  it('fails a delayed capture that settled while the build was still held (error case)', () => {
    const gate = fakeGate();
    checkSettleControl(gate, settleControl({ isHeldBuildReleased: false }));
    expect(gate.failures).toEqual([
      '[texture settle] the delayed capture settled while the build was still held back: it cannot ' +
        'have waited for the texture',
    ]);
  });
});
