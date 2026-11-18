import { describe, expect, it } from 'vitest';
import { CLEAN_LOAD, fakeGate } from './gate.testkit.mjs';
import { checkCameraButtons, EXPECTED, MOVED_PIXELS } from './cameraButtonsScenario.mjs';

/** A run that shows each step as expected, the way the fixed panel measures. */
function passingRun() {
  return Object.entries(EXPECTED).map(([name, expected]) => ({
    name,
    start: { disabled: [], ...expected.start, moved: 0 },
    steps: expected.steps.map((step, index) => ({
      row: `row ${index}`,
      disabled: [],
      ...step,
      moved: step.moved ? MOVED_PIXELS * 10 : 0,
    })),
    diagnostics: CLEAN_LOAD,
  }));
}

function failuresOf(run) {
  const gate = fakeGate();
  checkCameraButtons(gate, run);
  return gate.failures;
}

describe('checkCameraButtons', () => {
  it('passes a run whose every step shows its view, its marks and its drawing', () => {
    expect(failuresOf(passingRun())).toEqual([]);
  });

  it('fails an In-game click that leaves the drawn view where it was', () => {
    const run = passingRun();
    run.find((r) => r.name === 'In-game 3D').steps[0].moved = 0;
    expect(failuresOf(run)).toEqual([
      '[camera buttons] In-game 3D after a click on row 0 moved 0 px of the view, expected over 100',
    ]);
  });

  it('fails a click that leaves the In-game view for another view', () => {
    const run = passingRun();
    run.find((r) => r.name === 'In-game 2D').steps[0].view = '2D';
    expect(failuresOf(run)).toEqual([
      '[camera buttons] In-game 2D after a click on row 0 shows the 2D view, expected In-game',
    ]);
  });

  it('fails a panel that marks another row than the camera the view draws through', () => {
    const run = passingRun();
    run.find((r) => r.name === 'In-game 3D').start.active = ['Editor camera'];
    expect(failuresOf(run)).toEqual([
      '[camera buttons] In-game 3D at the start shows ["Editor camera"] as active, expected ["Front"]',
    ]);
  });
});
