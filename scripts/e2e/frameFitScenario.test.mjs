import { describe, expect, it } from 'vitest';
import { CLEAN_LOAD, fakeGate } from './gate.testkit.mjs';
import { checkFrameFit } from './frameFitScenario.mjs';

/** The run measured on the fix: the box inside a tall view, and centred only by the frame on open. */
function passingRun() {
  return {
    orthographic: { span: { left: 0.176, right: 0.824 }, aspect: 0.22, diagnostics: CLEAN_LOAD },
    unframed: { span: null, diagnostics: CLEAN_LOAD },
    framed: { span: { left: 0, right: 0.945 }, diagnostics: CLEAN_LOAD },
  };
}

function failuresOf(run) {
  const gate = fakeGate();
  checkFrameFit(gate, run);
  return gate.failures;
}

describe('checkFrameFit', () => {
  it('passes a run whose frames hold the whole box', () => {
    expect(failuresOf(passingRun())).toEqual([]);
  });

  it('fails an orthographic frame that runs to the canvas edges, as main measured', () => {
    const run = passingRun();
    run.orthographic.span = { left: 0.0026, right: 0.9974 };
    expect(failuresOf(run)).toEqual([expect.stringContaining('cut Root at the canvas edge')]);
  });

  it('fails a frame on open that leaves the box off the middle', () => {
    const run = passingRun();
    run.framed.span = { left: 0.6, right: 0.9 };
    expect(failuresOf(run)).toEqual([expect.stringContaining('frame on open left the box')]);
  });
});
