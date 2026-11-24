import { describe, expect, it } from 'vitest';
import { CLEAN_LOAD, fakeGate } from './gate.testkit.mjs';
import { checkZoomButtons, MAX_READOUT, MIN_READOUT } from './zoomButtonsScenario.mjs';

/** A run on a 631 px stage where the pill ends before the HUD and both ends of the range hold. */
function passingRun() {
  return {
    layout: {
      stageWidth: 631,
      pill: { x: 12, y: 600, width: 200, height: 24 },
      hud: { x: 220, y: 596, width: 192, height: 34 },
    },
    opened: '49.9%',
    afterOut: '41.6%',
    afterIn: '49.9%',
    top: { readout: MAX_READOUT, clicks: 31 },
    bottom: { readout: MIN_READOUT, clicks: 53 },
    diagnostics: CLEAN_LOAD,
  };
}

function failuresOf(run) {
  const gate = fakeGate();
  checkZoomButtons(gate, run);
  return gate.failures;
}

describe('checkZoomButtons', () => {
  it('passes a run whose clicks reach both ends of the range', () => {
    expect(failuresOf(passingRun())).toEqual([]);
  });

  it('fails a pill that reaches into the zoom HUD', () => {
    const run = passingRun();
    run.layout.pill.width = 220;
    expect(failuresOf(run)).toHaveLength(1);
    expect(failuresOf(run)[0]).toContain('covers the zoom HUD');
  });

  it('fails a minus click that leaves the readout as it was', () => {
    const run = passingRun();
    run.afterOut = run.opened;
    expect(failuresOf(run)).toEqual(['[zoom buttons] a click on minus left the readout at 49.9%']);
  });

  it('fails plus clicks that stop short of the top of the range', () => {
    const run = passingRun();
    run.top = { readout: '11848%', clicks: 30 };
    expect(failuresOf(run)).toEqual([
      `[zoom buttons] plus stopped at 11848% after 30 clicks, expected ${MAX_READOUT}`,
    ]);
  });

  it('fails minus clicks that stop short of the bottom of the range', () => {
    const run = passingRun();
    run.bottom = { readout: '0.94%', clicks: 52 };
    expect(failuresOf(run)).toEqual([
      `[zoom buttons] minus stopped at 0.94% after 52 clicks, expected ${MIN_READOUT}`,
    ]);
  });
});
