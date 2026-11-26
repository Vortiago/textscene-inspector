import { describe, expect, it } from 'vitest';
import { CLEAN_LOAD, fakeGate } from './gate.testkit.mjs';
import { checkClickTravel } from './clickTravelScenario.mjs';
import { LOCKED_PICK, OPEN_PICK } from './instanceClickScenario.mjs';

const CENTRES = { left: { x: 1, y: 1 }, right: { x: 8, y: 2 } };
const PASSING = {
  onBox: [OPEN_PICK],
  onNothing: [],
  onOtherBox: [LOCKED_PICK],
  dragOnNothing: [LOCKED_PICK],
};

function failuresOf(run) {
  const gate = fakeGate();
  checkClickTravel(gate, { centres: CENTRES, diagnostics: CLEAN_LOAD, ...PASSING, ...run });
  return gate.failures;
}

describe('checkClickTravel', () => {
  it('passes picks and clears within the click travel, and a drag that keeps the selection', () => {
    expect(failuresOf({})).toEqual([]);
  });

  it('fails a click on nothing within the click travel that keeps the selection', () => {
    expect(failuresOf({ onNothing: [OPEN_PICK] })).toEqual([
      `[click travel] a click on nothing that moves 8 px selects [${OPEN_PICK}], expected []`,
    ]);
  });

  it('fails a click on a box within the click travel that picks nothing', () => {
    expect(failuresOf({ onOtherBox: [] })).toEqual([
      `[click travel] a click on a box that moves 8 px selects [], expected [${LOCKED_PICK}]`,
    ]);
  });

  it('fails a drag that clears the selection', () => {
    expect(failuresOf({ dragOnNothing: [] })).toEqual([
      `[click travel] a drag of 20 px from nothing selects [], expected [${LOCKED_PICK}]`,
    ]);
  });

  it('fails a view that draws no box to click', () => {
    expect(failuresOf({ centres: null })).toEqual([
      '[click travel] the view draws no red box, so no click was made',
    ]);
  });
});
