import { describe, expect, it } from 'vitest';
import { compareToBudget, parseWorkCounts } from './workCounts.mjs';

/** An overlay snapshot: the draws total, then each row's step, CPU ms, GPU ms, draws and runs. */
const SNAPSHOT = {
  drawCalls: '12 draws',
  rows: [
    ['Shadows', '0.40', '–', '3', '1'],
    ['Other', '1.20', '–', '9', '1'],
  ],
};

const WORK = {
  drawCalls: 12,
  steps: { Shadows: { drawCalls: 3, runs: 1 }, Other: { drawCalls: 9, runs: 1 } },
};

describe('parseWorkCounts', () => {
  it("reads the frame's draw calls and each step's draw calls and runs", () => {
    expect(parseWorkCounts(SNAPSHOT)).toEqual(WORK);
  });

  it('keeps the decimal of a count that differs between the frames of a window', () => {
    const snapshot = { drawCalls: '12.5 draws', rows: [['Fog', '0.10', '–', '0.5', '0.5']] };
    expect(parseWorkCounts(snapshot).steps.Fog).toEqual({ drawCalls: 0.5, runs: 0.5 });
  });

  it('refuses a snapshot taken before the first window, with no count to read (error case)', () => {
    expect(() => parseWorkCounts({ drawCalls: '', rows: [] })).toThrow(
      'expected a count such as "12 draws" in the draws total, got ""'
    );
  });
});

describe('compareToBudget', () => {
  it('passes work that matches its budget', () => {
    expect(compareToBudget(WORK, WORK)).toEqual({ overruns: [], slack: [] });
  });

  it('names each count over its budget, with the budget and the measured value', () => {
    const measured = { ...WORK, drawCalls: 14, steps: { ...WORK.steps, Shadows: { drawCalls: 5, runs: 1 } } };
    expect(compareToBudget(measured, WORK).overruns).toEqual([
      'draw calls: 14, budget 12',
      'Shadows draw calls: 5, budget 3',
    ]);
  });

  it('counts a step the budget does not list as over a budget of zero', () => {
    const measured = { ...WORK, steps: { ...WORK.steps, Fog: { drawCalls: 2, runs: 1 } } };
    expect(compareToBudget(measured, WORK).overruns).toEqual([
      'Fog draw calls: 2, budget 0',
      'Fog runs: 1, budget 0',
    ]);
  });

  it('names a count under its budget as slack, which an update takes in (edge case)', () => {
    const measured = { drawCalls: 9, steps: { Other: { drawCalls: 9, runs: 1 } } };
    expect(compareToBudget(measured, WORK)).toEqual({
      overruns: [],
      slack: ['draw calls: 9, budget 12', 'Shadows draw calls: 0, budget 3', 'Shadows runs: 0, budget 1'],
    });
  });
});
