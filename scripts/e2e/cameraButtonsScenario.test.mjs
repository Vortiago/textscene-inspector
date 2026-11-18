import { describe, expect, it } from 'vitest';
import { CLEAN_LOAD, fakeGate } from './gate.testkit.mjs';
import { CASES, checkCameraButtons, MOVED_PIXELS } from './cameraButtonsScenario.mjs';

const MOVED = MOVED_PIXELS * 10;

/** The pixels a step moved against the start and against the step it names, as the expected step asks. */
function movementOf(expected) {
  const movedFromReference = expected.sameAs !== undefined ? 0 : MOVED;
  return { moved: expected.moved === false ? 0 : MOVED, movedFromReference };
}

/** A run that shows each step as expected, the way the fixed tab measures. */
function passingRun() {
  return CASES.map(({ name, expected }) => ({
    name,
    expected,
    start: { rows: [], disabled: [], isEmpty: false, ...expected.start },
    steps: expected.steps.map((step, index) => ({
      step: `step ${index + 1}`,
      rows: [],
      disabled: [],
      isEmpty: false,
      ...step,
      ...movementOf(step),
    })),
    diagnostics: CLEAN_LOAD,
  }));
}

function failuresOf(run) {
  const gate = fakeGate();
  checkCameraButtons(gate, run);
  return gate.failures;
}

const caseOf = (run, name) => run.find((result) => result.name === name);

describe('checkCameraButtons', () => {
  it('passes a run whose every step shows its view, its marks and its drawing', () => {
    expect(failuresOf(passingRun())).toEqual([]);
  });

  it('fails an In-game click that leaves the drawn view where it was', () => {
    const run = passingRun();
    caseOf(run, 'In-game click').steps[0].moved = 0;
    expect(failuresOf(run)).toEqual([
      '[camera buttons] In-game click after step 1 moved 0 px of the view against the start, expected over 100',
    ]);
  });

  it('fails a click that leaves the In-game view for another view', () => {
    const run = passingRun();
    caseOf(run, 'In-game 2D').steps[0].view = '2D';
    expect(failuresOf(run)).toEqual([
      '[camera buttons] In-game 2D after step 1 shows the 2D view, expected In-game',
    ]);
  });

  it('fails a tab that marks another row than the camera the view draws through', () => {
    const run = passingRun();
    caseOf(run, 'In-game click').start.active = ['Editor camera'];
    expect(failuresOf(run)).toEqual([
      '[camera buttons] In-game click at the start shows ["Editor camera"] as active, expected ["Front"]',
    ]);
  });

  it('fails an In-game view that draws the editor preview instead of the game camera', () => {
    const run = passingRun();
    caseOf(run, 'Preview then In-game').steps[2].movedFromReference = 0;
    expect(failuresOf(run)).toEqual([
      '[camera buttons] Preview then In-game after step 3 moved 0 px of the view against step 2, expected over 100',
    ]);
  });

  it('fails a tab that shows rows for a scene with no camera', () => {
    const run = passingRun();
    caseOf(run, 'No camera in In-game').start.isEmpty = false;
    expect(failuresOf(run)).toEqual([
      '[camera buttons] No camera in In-game at the start does not show the empty-tab note',
    ]);
  });
});
