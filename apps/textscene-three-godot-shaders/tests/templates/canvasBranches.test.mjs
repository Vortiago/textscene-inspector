import { describe, expect, it } from 'vitest';
import { CANVAS_SCENES } from '../e2e/canvasScenes.mjs';
import { canvasBranchStates, DRAWN, NOT_BUILT, OPEN } from './canvasBranches.mjs';

const states = canvasBranchStates(CANVAS_SCENES);
const allStates = Object.values(states).flatMap((stage) => Object.values(stage));

describe('the branches of the canvas template', () => {
  it('holds the state of each branch of both stages in canvasBranches.json', async () => {
    await expect(`${JSON.stringify(states, null, 2)}\n`).toMatchFileSnapshot('./canvasBranches.json');
  });

  it('gives each branch one of the three states', () => {
    const kinds = new Set(allStates.map((state) => (state.startsWith(`${OPEN}: `) ? OPEN : state)));
    expect(kinds).toEqual(new Set([DRAWN, OPEN, NOT_BUILT]));
  });

  it('names an open issue for each row of an open branch', () => {
    const open = allStates.filter((state) => state.startsWith(OPEN));
    expect(open.filter((state) => !/^open: .*\(#\d+\)$/.test(state))).toEqual([]);
  });

  it('marks a branch of a variant no scene draws open, with the default shader as its row', () => {
    const rectsOnly = canvasBranchStates(CANVAS_SCENES.filter((scene) => scene.kind === 'rect'));
    const opened = Object.values(rectsOnly.vertex).filter((state) =>
      state.includes('the default shader (#1612)')
    );
    expect(opened.length).toBeGreaterThan(0);
  });
});
