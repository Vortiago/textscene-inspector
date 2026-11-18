import { describe, expect, it } from 'vitest';
import { CLEAN_LOAD, fakeGate } from './gate.testkit.mjs';
import { checkModeSwitch, OTHER_VIEW_PIXELS, PANEL_PIXELS, SAME_VIEW_PIXELS } from './modeSwitchScenario.mjs';

const view = (name) => ({
  view: name,
  isPressed: true,
  canvases: 1,
  has2DStage: name === '2D',
  isSelected: true,
});

/** A run that shows each claim as the one view measures it. */
function passingRun() {
  return {
    views: ['3D', '2D', 'In-game', '3D'].map(view),
    inGamePixels: OTHER_VIEW_PIXELS * 400,
    back3DPixels: 0,
    panelPixels2D: PANEL_PIXELS * 2,
    diagnostics: CLEAN_LOAD,
  };
}

function failuresOf(run) {
  const gate = fakeGate();
  checkModeSwitch(gate, run);
  return gate.failures;
}

describe('checkModeSwitch', () => {
  it('passes a run that draws each mode on one canvas and keeps the selection', () => {
    expect(failuresOf(passingRun())).toEqual([]);
  });

  it('fails a 2D mode that mounts no 2D stage', () => {
    const run = passingRun();
    run.views[1].has2DStage = false;
    expect(failuresOf(run)).toEqual(['[Mode switch] 2D: the 2D stage is absent, expected it only in 2D']);
  });

  it('fails a first 2D view that stays blank while its stage loads', () => {
    const run = passingRun();
    run.panelPixels2D = 0;
    expect(failuresOf(run)).toEqual([
      `[Mode switch] the first 2D view drew 0 px of the ColorRect, expected over ${PANEL_PIXELS}`,
    ]);
  });

  it('fails a view switch that leaves a second canvas mounted', () => {
    const run = passingRun();
    run.views[2].canvases = 2;
    expect(failuresOf(run)).toEqual(['[Mode switch] In-game: the viewport holds 2 canvases, expected 1']);
  });

  it('fails a switch that drops the selection', () => {
    const run = passingRun();
    run.views[3].isSelected = false;
    expect(failuresOf(run)).toEqual(['[Mode switch] 3D: Main/Box lost its selection in the scene tree']);
  });

  it('fails an In-game view that draws the editor’s frame', () => {
    const run = passingRun();
    run.inGamePixels = 0;
    expect(failuresOf(run)).toHaveLength(1);
  });

  it('fails a 3D view that draws another frame after the round trip', () => {
    const run = passingRun();
    run.back3DPixels = SAME_VIEW_PIXELS * 50;
    expect(failuresOf(run)).toHaveLength(1);
  });
});
