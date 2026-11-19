import { describe, expect, it } from 'vitest';
import { CLEAN_LOAD, fakeGate } from './gate.testkit.mjs';
import { checkEditorHelpers, FOG_FIXTURE, HELPERS_FIXTURE } from './editorHelpersScenario.mjs';

/** A run that shows each claim as the fixed view measures it, the counts of a run on SwiftShader. */
function passingRun() {
  return {
    helpers: {
      pixels: {
        Gizmos: 783,
        Collisions: 2151,
        Labels: 19280,
        Navigation: 147836,
        Grid: 7385,
        'Preview Sun': 16168,
        'Preview Sky': 439064,
      },
      diagnostics: CLEAN_LOAD,
    },
    fog: { pixels: { Fog: 463392 }, diagnostics: CLEAN_LOAD },
    performance: { shownOn: true, shownOff: false, diagnostics: CLEAN_LOAD },
  };
}

function failuresOf(run) {
  const gate = fakeGate();
  checkEditorHelpers(gate, run);
  return gate.failures;
}

describe('checkEditorHelpers', () => {
  it('passes a view in which each toggle changes the frame', () => {
    expect(failuresOf(passingRun())).toEqual([]);
  });

  it('fails a toggle that changes nothing the view draws', () => {
    const run = passingRun();
    run.helpers.pixels.Gizmos = 0;
    expect(failuresOf(run)).toEqual([
      `[Editor helpers] Gizmos on ${HELPERS_FIXTURE} changed 0 px, expected over 300`,
    ]);
  });

  it('fails a Fog toggle that leaves the fog', () => {
    const run = passingRun();
    run.fog.pixels.Fog = 12;
    expect(failuresOf(run)).toEqual([
      `[Editor helpers] Fog on ${FOG_FIXTURE} changed 12 px, expected over 300`,
    ]);
  });

  it('fails a Performance toggle that shows no panel', () => {
    const run = passingRun();
    run.performance.shownOn = false;
    expect(failuresOf(run)).toEqual(['[Editor helpers] Performance on shows no panel over the view']);
  });

  it('fails a panel that stays after the toggle turns off', () => {
    const run = passingRun();
    run.performance.shownOff = true;
    expect(failuresOf(run)).toEqual(['[Editor helpers] Performance off still shows the panel']);
  });
});
