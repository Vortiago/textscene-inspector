import { describe, expect, it } from 'vitest';
import { CLEAN_LOAD, fakeGate } from './gate.testkit.mjs';
import {
  BOX_PIXELS,
  CAMERA_FIXTURE,
  checkInGameToolbar,
  EXPECTED_NOTES,
  NO_EFFECT_IN_GAME,
} from './inGameToolbarScenario.mjs';

const LABELS = [...NO_EFFECT_IN_GAME.slice(0, 4), 'Performance', ...NO_EFFECT_IN_GAME.slice(4)];

function toggles(isInGame) {
  return LABELS.map((label) => ({
    label,
    checked: label === 'Grid',
    disabled: isInGame && label !== 'Performance',
  }));
}

/** A run that shows each claim as the fixed toolbar measures it. */
function passingRun() {
  return {
    notes: { notes: EXPECTED_NOTES, diagnostics: CLEAN_LOAD },
    noNotes: { notes: [], diagnostics: CLEAN_LOAD },
    toggles: { inGame: toggles(true), backIn3D: toggles(false), diagnostics: CLEAN_LOAD },
    selection: {
      threeD: { isSelected: true, pixels: BOX_PIXELS * 7 },
      inGame: { isSelected: true, pixels: 0 },
      diagnostics: CLEAN_LOAD,
    },
  };
}

function failuresOf(run) {
  const gate = fakeGate();
  checkInGameToolbar(gate, run);
  return gate.failures;
}

describe('checkInGameToolbar', () => {
  it('passes a run that shows the notes, the disabled toggles and no box', () => {
    expect(failuresOf(passingRun())).toEqual([]);
  });

  it('fails a scene with no camera that shows only the scripts note', () => {
    const run = passingRun();
    run.notes.notes = EXPECTED_NOTES.slice(0, 1);
    expect(failuresOf(run)).toHaveLength(1);
  });

  it('fails a note on a scene with a camera and no script', () => {
    const run = passingRun();
    run.noNotes.notes = EXPECTED_NOTES.slice(1);
    expect(failuresOf(run)).toEqual([
      `[In-game notes] ${CAMERA_FIXTURE} shows ${JSON.stringify(EXPECTED_NOTES.slice(1))}, expected no note`,
    ]);
  });

  it('fails a Grid toggle left live In-game', () => {
    const run = passingRun();
    run.toggles.inGame.find((toggle) => toggle.label === 'Grid').disabled = false;
    expect(failuresOf(run)).toHaveLength(1);
  });

  it('fails a Grid choice that the In-game view drops', () => {
    const run = passingRun();
    run.toggles.backIn3D.find((toggle) => toggle.label === 'Grid').checked = false;
    expect(failuresOf(run)).toEqual(['[In-game toggles] back in 3D, Grid is off, expected on']);
  });

  it('fails a selection box drawn In-game', () => {
    const run = passingRun();
    run.selection.inGame.pixels = BOX_PIXELS * 7;
    expect(failuresOf(run)).toHaveLength(1);
  });

  it('fails a run whose 3D view drew no box, since then no box In-game proves nothing', () => {
    const run = passingRun();
    run.selection.threeD.pixels = 0;
    expect(failuresOf(run)).toHaveLength(1);
  });
});
